const core = require('@actions/core');
const github = require('@actions/github');
const analyzePR = require('../analyzer/prAnalyzer');

async function run() {
  try {
    const token = core.getInput('github_token');
    if (token) {
      process.env.GITHUB_TOKEN = token;
    }

    const { context } = github;
    if (context.eventName !== 'pull_request') {
      core.info('This action only runs on pull requests.');
      return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const prNumber = context.payload.pull_request.number;

    core.info(`Analyzing PR: ${owner}/${repo}#${prNumber}`);

    const result = await analyzePR(owner, repo, prNumber);

    core.info(`Analysis complete. Score: ${result.score}`);

    const octokit = github.getOctokit(token);
    
    // Format the comment
    const commentBody = `
## ChunkCheck PR Analysis

**Score**: ${result.score}/100 - ${result.summary}

### Metrics
- **Files Changed**: ${result.metrics.filesChanged}
- **Lines Changed**: +${result.metrics.additions} -${result.metrics.deletions} (${result.metrics.linesChanged} total)
- **Tests Detected**: ${result.metrics.testsDetected}
- **CI Status**: ${result.metrics.ciStatus}
- **Commits**: ${result.metrics.commits}

### Strengths
${result.strengths.length > 0 ? result.strengths.map(s => `- ${s}`).join('\\n') : '- None identified.'}

### Analysis & Suggestions
${result.analysis.length > 0 ? result.analysis.map(a => `- ${a}`).join('\\n') : ''}
${result.suggestions.length > 0 ? result.suggestions.map(s => `- ${s}`).join('\\n') : ''}
`;

    // Find if we already commented
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    const existingComment = comments.find(c => c.body.includes('## ChunkCheck PR Analysis'));

    if (existingComment) {
      core.info('Updating existing comment');
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body: commentBody,
      });
    } else {
      core.info('Creating new comment');
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody,
      });
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
