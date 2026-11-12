async function sendAnalysis(req, res) {
  try {
    const { parsePullRequestUrl } = require("../utils/parsePrUrl");
    const parsed = req.query.url
      ? parsePullRequestUrl(req.query.url)
      : {
          owner: req.query.owner,
          repo: req.query.repo,
          prNumber: Number(req.query.pr)
        };

    if (!parsed.owner || !parsed.repo || !parsed.prNumber) {
      return res.status(400).json({
        error:
          "Provide either ?url=https://github.com/{owner}/{repo}/pull/{number} or ?owner={owner}&repo={repo}&pr={number}"
      });
    }

    const analyzePR = require("../analyzer/prAnalyzer");
    const token = req.headers["x-github-token"] || process.env.GITHUB_TOKEN;
    const result = await analyzePR(parsed.owner, parsed.repo, parsed.prNumber, token);

    return res.status(200).json(result);
  } catch (error) {
    const statusCode =
      error.status || (/Unable to parse PR URL/.test(error.message || "") ? 400 : 500);

    let message = error.response?.data?.message || error.message || "Failed to analyze pull request";
    
    // Clean up GitHub's long rate limit message
    if (message.includes('(But here')) {
      message = message.split(' (But here')[0];
    }

    if (statusCode === 404) {
      message = "Pull request not found. Check the URL — private repositories need a GitHub token on the server.";
    } else if (statusCode === 403 && /rate limit/i.test(message)) {
      message = "GitHub's API rate limit was reached. Please try again in a few minutes.";
    }

    return res.status(statusCode).json({
      error: message
    });
  }
}

module.exports = {
  sendAnalysis
};
