const { Octokit } = require("@octokit/rest");

if (!process.env.GITHUB_TOKEN) {
  console.warn("GITHUB_TOKEN is not set. Public PRs may be rate-limited.");
}

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

async function getPullRequestContext(owner, repo, pullNumber) {
  const [prResponse, filesResponse, commitsResponse] = await Promise.all([
    octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber
    }),
    paginateFiles(owner, repo, pullNumber),
    paginateCommits(owner, repo, pullNumber)
  ]);

  const headSha = prResponse.data.head.sha;

  const [statusResponse, checkRunsResponse] = await Promise.allSettled([
    octokit.repos.getCombinedStatusForRef({
      owner,
      repo,
      ref: headSha
    }),
    octokit.checks.listForRef({
      owner,
      repo,
      ref: headSha
    })
  ]);

  return {
    pr: prResponse.data,
    files: filesResponse,
    commits: commitsResponse,
    status:
      statusResponse.status === "fulfilled" ? statusResponse.value.data : null,
    checkRuns:
      checkRunsResponse.status === "fulfilled" ? checkRunsResponse.value.data : null
  };
}

async function paginateFiles(owner, repo, pullNumber) {
  return octokit.paginate(octokit.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  });
}

async function paginateCommits(owner, repo, pullNumber) {
  return octokit.paginate(octokit.pulls.listCommits, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  });
}

module.exports = {
  getPullRequestContext
};
