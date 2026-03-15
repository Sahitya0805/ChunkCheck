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

function scorePR({ owner, repo, prNumber, pr, files, commits, metrics }) {
  const suggestions = [];
  const strengths = [];
  const penalties = [];

  let score = 100;

  if (metrics.filesChanged > 10) {
    score -= 10;
    suggestions.push("Split the PR into smaller changesets.");
    penalties.push("High file count increases review effort.");
  } else if (metrics.filesChanged <= 5) {
    strengths.push("Small file count keeps the PR reviewable.");
  }

  if (metrics.linesChanged > 500) {
    score -= 15;
    suggestions.push("Reduce the total diff size to make the PR easier to review.");
    penalties.push("Large diffs are harder to validate and merge safely.");
  } else if (metrics.linesChanged <= 250) {
    strengths.push("Diff size is compact and reviewer-friendly.");
  }

  if (!metrics.testsDetected && hasSourceCodeChanges(files)) {
    score -= 15;
    suggestions.push("Add or update automated tests for the changed behavior.");
    penalties.push("Source code changed without matching test coverage.");
  } else if (metrics.testsDetected) {
    strengths.push("Tests were detected in the PR.");
  }

  if (metrics.ciStatus === "failing") {
    score -= 20;
    suggestions.push("Fix failing CI checks before requesting review.");
    penalties.push("CI is currently failing.");
  } else if (metrics.ciStatus === "passing") {
    strengths.push("CI checks are passing.");
  } else {
    suggestions.push("Ensure CI is configured and reports status on the PR.");
  }

  const vagueCommitMessages = commits.filter((commit) =>
    VAGUE_COMMIT_MESSAGE_PATTERNS.some((pattern) =>
      pattern.test(commit.commit.message.split("\n")[0].trim())
    )
  );

  if (vagueCommitMessages.length > 0) {
    score -= Math.min(10, vagueCommitMessages.length * 3);
    suggestions.push("Use clearer commit messages that describe the behavior change.");
    penalties.push("Some commit messages are too vague.");
  } else if (commits.length > 0) {
    strengths.push("Commit messages appear descriptive.");
  }

  if (needsDocumentation(files) && !hasDocumentationChanges(files)) {
    score -= 10;
    suggestions.push("Add documentation or changelog updates for externally visible changes.");
    penalties.push("The PR may change behavior without documentation updates.");
  } else if (hasDocumentationChanges(files)) {
    strengths.push("Documentation updates were included.");
  }

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    repository: `${owner}/${repo}`,
    pullRequest: {
      number: prNumber,
      title: pr.title,
      url: pr.html_url,
      author: pr.user?.login || null
    },
    score: finalScore,
    summary: formatSummary(finalScore),
    metrics: {
      filesChanged: metrics.filesChanged,
      additions: metrics.additions,
      deletions: metrics.deletions,
      linesChanged: metrics.linesChanged,
      testsDetected: metrics.testsDetected ? "Yes" : "No",
      ciStatus: capitalize(metrics.ciStatus),
      commits: commits.length
    },
    strengths,
    suggestions: dedupeSuggestions(suggestions),
    analysis: penalties
  };
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

function dedupeSuggestions(suggestions) {
  return [...new Set(suggestions)];
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
