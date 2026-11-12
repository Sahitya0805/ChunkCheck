const { getPullRequestContext } = require("../services/githubService");

async function sendRepoPRs(req, res) {
  try {
    const { owner, repo } = req.query;
    
    if (!owner || !repo) {
      return res.status(400).json({ error: "Missing owner or repo" });
    }

    // Dynamic import to avoid CJS/ESM issues with octokit
    const { Octokit } = await import("@octokit/rest");
    const token = req.headers["x-github-token"] || process.env.GITHUB_TOKEN;
    const octokit = token ? new Octokit({ auth: token }) : new Octokit();

    // Fetch the last 10 closed/merged PRs
    const prsResponse = await octokit.pulls.list({
      owner,
      repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: 30
    });

    // We only want merged PRs
    const mergedPRs = prsResponse.data.filter(pr => pr.merged_at);

    // The 10 most recently merged PRs
    const recentPRs = mergedPRs.slice(0, 10);

    // We'll return just the basics, and the frontend will request analysis
    return res.status(200).json(recentPRs.map(pr => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      merged_at: pr.merged_at
    })));

  } catch (error) {
    console.error("Dashboard API Error:", error);
    const status = error.status || 500;
    let message = error.response?.data?.message || error.message || "Failed to fetch repository PRs";
    
    // Clean up GitHub's long rate limit message
    if (message.includes('(But here')) {
      message = message.split(' (But here')[0];
    }
    
    res.status(status).json({ error: message });
  }
}

module.exports = sendRepoPRs;
