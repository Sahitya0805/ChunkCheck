const { getPullRequestContext } = require("../services/githubService");
const checkCIStatus = require("./ciChecker");
const scorePR = require("./scoringEngine");
const detectTests = require("./testDetector");

async function analyzePR(owner, repo, prNumber) {
  const { pr, files, commits, status, checkRuns } = await getPullRequestContext(
    owner,
    repo,
    prNumber
  );

  const filesChanged = files.length;
  const additions = files.reduce((sum, file) => sum + (file.additions || 0), 0);
  const deletions = files.reduce((sum, file) => sum + (file.deletions || 0), 0);
  const linesChanged = additions + deletions;
  const testsDetected = detectTests(files);
  const ci = checkCIStatus(status, checkRuns);

  return scorePR({
    owner,
    repo,
    prNumber,
    pr,
    files,
    commits,
    metrics: {
      filesChanged,
      additions,
      deletions,
      linesChanged,
      testsDetected,
      ciStatus: ci.summary
    }
  });
}

module.exports = analyzePR;
