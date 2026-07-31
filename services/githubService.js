if (!process.env.GITHUB_TOKEN) {
  console.warn("GITHUB_TOKEN is not set. Public PRs may be rate-limited.");
}

let octokitInstance;
async function getOctokit(token) {
  if (token) {
    const { Octokit } = await import("@octokit/rest");
    return new Octokit({ auth: token });
  }

  if (!octokitInstance) {
    const { Octokit } = await import("@octokit/rest");
    octokitInstance = process.env.GITHUB_TOKEN ? new Octokit({ auth: process.env.GITHUB_TOKEN }) : new Octokit();
  }
  return octokitInstance;
}

async function getPullRequestContext(owner, repo, pullNumber, token) {
  const octokit = await getOctokit(token);
  const [prResponse, filesResponse, commitsResponse] = await Promise.all([
    octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber
    }),
    paginateFiles(owner, repo, pullNumber, token),
    paginateCommits(owner, repo, pullNumber, token)
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

async function paginateFiles(owner, repo, pullNumber, token) {
  const octokit = await getOctokit(token);
  return octokit.paginate(octokit.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  });
}

async function paginateCommits(owner, repo, pullNumber, token) {
  const octokit = await getOctokit(token);
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
