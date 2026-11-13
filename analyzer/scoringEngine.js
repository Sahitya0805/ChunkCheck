const DOCUMENTATION_PATTERNS = [
  /^docs?\//i,
  /readme/i,
  /changelog/i,
  /\.mdx?$/i,
  /\.rst$/i
];

const SOURCE_CODE_PATTERNS = [
  /\.(js|jsx|ts|tsx|rb|py|go|java|kt|swift|php|cs|cpp|c|h|hpp|rs|scala)$/i,
  /^src\//i,
  /^app\//i,
  /^lib\//i,
  /^backend\//i,
  /^frontend\//i
];

const VAGUE_COMMIT_MESSAGE_PATTERNS = [
  /^fix$/i,
  /^update$/i,
  /^changes?$/i,
  /^misc/i,
  /^wip$/i,
  /^stuff$/i
];

// Each category contributes points to the 0-100 score. The weights add up to 100.
const WEIGHTS = {
  size: 30,
  tests: 20,
  ci: 25,
  commits: 10,
  docs: 15
};

function classifySize(linesChanged, filesChanged) {
  if (linesChanged > 500 || (filesChanged > 20 && linesChanged > 250)) return "Large";
  if (linesChanged > 250 || filesChanged > 10) return "Medium";
  return "Compact";
}

function scoreSize({ linesChanged, filesChanged }) {
  const linePoints =
    linesChanged <= 250 ? 18 : linesChanged <= 500 ? 12 : linesChanged <= 1000 ? 6 : 0;
  const filePoints =
    filesChanged <= 5 ? 12 : filesChanged <= 10 ? 9 : filesChanged <= 20 ? 5 : 2;
  const sizeClass = classifySize(linesChanged, filesChanged);
  const result = { points: linePoints + filePoints, sizeClass };

  if (sizeClass === "Compact") {
    result.strength = `Compact diff (${linesChanged} lines across ${filesChanged} files) is easy to review.`;
  } else if (linesChanged <= 250) {
    // Many files but few lines: usually a mechanical, repo-wide change.
    result.strength = `Small line count (${linesChanged} lines) keeps the change easy to read.`;
    result.risk = `Touches ${filesChanged} files, so reviewers have more places to check.`;
    result.suggestion = "If the edits are unrelated, group them into smaller PRs by area.";
  } else {
    result.risk = `${linesChanged} lines across ${filesChanged} files takes longer to review safely.`;
    result.suggestion = "Split the work into smaller PRs that each make one change.";
  }

  return result;
}

function scoreTests(metrics, files) {
  if (metrics.testsDetected) {
    return { points: WEIGHTS.tests, strength: "Tests were added or updated." };
  }
  if (!hasSourceCodeChanges(files)) {
    return { points: WEIGHTS.tests, note: "No source code changed, so tests are not required." };
  }
  return {
    points: 0,
    risk: "Source code changed without any test changes.",
    suggestion: "Add a test that proves the changed behavior."
  };
}

function scoreCi(ciStatus) {
  if (ciStatus === "passing") {
    return { points: WEIGHTS.ci, strength: "All CI checks are passing." };
  }
  if (ciStatus === "failing") {
    return {
      points: 0,
      risk: "CI is failing.",
      suggestion: "Fix the failing CI checks before asking for review."
    };
  }
  if (ciStatus === "pending") {
    return {
      points: Math.round(WEIGHTS.ci / 2),
      note: "CI is still running; re-run the analysis when it finishes."
    };
  }
  return {
    points: Math.round(WEIGHTS.ci / 2),
    risk: "No CI status was reported on this PR.",
    suggestion: "Set up CI so every PR reports a build and test status."
  };
}

function scoreCommits(commits) {
  if (commits.length === 0) {
    return { points: WEIGHTS.commits };
  }
  const vague = commits.filter((commit) =>
    VAGUE_COMMIT_MESSAGE_PATTERNS.some((pattern) =>
      pattern.test(commit.commit.message.split("\n")[0].trim())
    )
  );
  if (vague.length === 0) {
    return { points: WEIGHTS.commits, strength: "Commit messages are descriptive." };
  }
  return {
    points: Math.max(0, WEIGHTS.commits - vague.length * 3),
    risk: `${vague.length} commit message(s) are too vague to explain the change.`,
    suggestion: "Reword vague commit messages to say what changed and why."
  };
}

function scoreDocs(files) {
  if (hasDocumentationChanges(files)) {
    return { points: WEIGHTS.docs, strength: "Documentation was updated." };
  }
  if (!needsDocumentation(files)) {
    return { points: WEIGHTS.docs };
  }
  return {
    points: 8,
    risk: "Code changed but no docs, README or changelog were updated.",
    suggestion: "If users will notice this change, update the docs or changelog."
  };
}

function scorePR({ owner, repo, prNumber, pr, files, commits, metrics }) {
  const size = scoreSize(metrics);
  const categories = [
    { key: "size", label: "Size", ...size },
    { key: "tests", label: "Tests", ...scoreTests(metrics, files) },
    { key: "ci", label: "CI", ...scoreCi(metrics.ciStatus) },
    { key: "commits", label: "Commits", ...scoreCommits(commits) },
    { key: "docs", label: "Docs", ...scoreDocs(files) }
  ];

  const score = Math.max(
    0,
    Math.min(100, categories.reduce((sum, category) => sum + category.points, 0))
  );

  const pick = (field) => [...new Set(categories.map((c) => c[field]).filter(Boolean))];

  return {
    repository: `${owner}/${repo}`,
    pullRequest: {
      number: prNumber,
      title: pr.title,
      url: pr.html_url,
      author: pr.user?.login || null
    },
    score,
    summary: formatSummary(score),
    sizeClass: size.sizeClass,
    breakdown: categories.map(({ key, label, points, note }) => ({
      key,
      label,
      points,
      max: WEIGHTS[key],
      note: note || null
    })),
    metrics: {
      filesChanged: metrics.filesChanged,
      additions: metrics.additions,
      deletions: metrics.deletions,
      linesChanged: metrics.linesChanged,
      testsDetected: metrics.testsDetected ? "Yes" : "No",
      ciStatus: capitalize(metrics.ciStatus),
      commits: commits.length
    },
    largestFiles: largestFiles(files),
    strengths: pick("strength"),
    suggestions: pick("suggestion"),
    analysis: pick("risk")
  };
}

// The changed files with the most lines, so reviewers know where to start.
function largestFiles(files, limit = 5) {
  return [...files]
    .map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      changes: file.changes ?? (file.additions || 0) + (file.deletions || 0)
    }))
    .filter((file) => file.changes > 0)
    .sort((a, b) => b.changes - a.changes || a.filename.localeCompare(b.filename))
    .slice(0, limit);
}

function hasSourceCodeChanges(files) {
  return files.some((file) =>
    SOURCE_CODE_PATTERNS.some((pattern) => pattern.test(file.filename))
  );
}

function hasDocumentationChanges(files) {
  return files.some((file) =>
    DOCUMENTATION_PATTERNS.some((pattern) => pattern.test(file.filename))
  );
}

function needsDocumentation(files) {
  return hasSourceCodeChanges(files) && files.some((file) => file.status !== "removed");
}

function formatSummary(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Needs a few improvements";
  return "High-risk PR";
}

function capitalize(value) {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

module.exports = scorePR;
module.exports.classifySize = classifySize;
module.exports.WEIGHTS = WEIGHTS;
module.exports.largestFiles = largestFiles;
