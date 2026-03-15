const analyzePR = require("../analyzer/prAnalyzer");
const { parsePullRequestUrl } = require("../utils/parsePrUrl");

function sendHealth(_req, res) {
  return res.status(200).json({ ok: true });
}

async function sendAnalysis(req, res) {
  try {
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

    const result = await analyzePR(parsed.owner, parsed.repo, parsed.prNumber);

    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.status || 500;

    return res.status(statusCode).json({
      error: error.message || "Failed to analyze pull request"
    });
  }
}

module.exports = {
  sendAnalysis,
  sendHealth
};
