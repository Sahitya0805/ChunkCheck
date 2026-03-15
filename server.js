require("dotenv").config();

const path = require("path");
const express = require("express");

const analyzePR = require("./analyzer/prAnalyzer");
const { parsePullRequestUrl } = require("./utils/parsePrUrl");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/analyze", async (req, res) => {
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

    return res.json(result);
  } catch (error) {
    const statusCode = error.status || 500;

    return res.status(statusCode).json({
      error: error.message || "Failed to analyze pull request"
    });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`ChunkCheck listening on port ${port}`);
  });
}

module.exports = app;
