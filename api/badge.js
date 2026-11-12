require("dotenv").config();

const { parsePullRequestUrl } = require("../utils/parsePrUrl");
const { scoreBadge } = require("../utils/badge");

// GET /api/badge?url=https://github.com/owner/repo/pull/123  ->  SVG score badge
module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  let score = null;
  try {
    const parsed = req.query.url
      ? parsePullRequestUrl(req.query.url)
      : { owner: req.query.owner, repo: req.query.repo, prNumber: Number(req.query.pr) };
    if (parsed.owner && parsed.repo && parsed.prNumber) {
      const analyzePR = require("../analyzer/prAnalyzer");
      const result = await analyzePR(parsed.owner, parsed.repo, parsed.prNumber, process.env.GITHUB_TOKEN);
      score = result.score;
    }
  } catch (_error) {
    score = null;
  }
  // Cache on the CDN for an hour so README views don't burn the GitHub API quota.
  res.setHeader("Cache-Control", score === null ? "public, max-age=300" : "public, s-maxage=3600, max-age=600");
  return res.status(200).send(scoreBadge(score));
};
