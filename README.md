# ChunkCheck

ChunkCheck is a small Node.js service and web UI that analyzes a GitHub pull request and returns a quality score from 0 to 100.

## Features

- Accepts a GitHub PR URL or `owner/repo/pr` query params
- Fetches PR metadata, changed files, commits, and CI status from GitHub
- Scores PR size, tests, CI, commit quality, and documentation signals
- Returns actionable suggestions in JSON
- Includes a homepage with a PR URL form and visual results dashboard

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create an environment file:

```bash
cp .env.example .env
```

3. Add a GitHub token to `.env`:

```bash
GITHUB_TOKEN=your_github_token_here
PORT=3004
```

4. Start the server:

```bash
PORT=3004 npm start
```

## Website

Open the app in your browser:

```bash
http://localhost:3004/
```

Health check:

```bash
http://localhost:3004/health
```

## API

Analyze by URL:

```bash
curl "http://localhost:3004/analyze?url=https://github.com/facebook/react/pull/30000"
```

Analyze by parts:

```bash
curl "http://localhost:3004/analyze?owner=facebook&repo=react&pr=30000"
```

Example response:

```json
{
  "repository": "facebook/react",
  "pullRequest": {
    "number": 30000,
    "title": "Example PR",
    "url": "https://github.com/facebook/react/pull/30000",
    "author": "octocat"
  },
  "score": 86,
  "summary": "Strong",
  "metrics": {
    "filesChanged": 5,
    "additions": 150,
    "deletions": 60,
    "linesChanged": 210,
    "testsDetected": "Yes",
    "ciStatus": "Passing",
    "commits": 3
  },
  "strengths": [
    "Diff size is compact and reviewer-friendly."
  ],
  "suggestions": [
    "Add documentation or changelog updates for externally visible changes."
  ],
  "analysis": [
    "The PR may change behavior without documentation updates."
  ]
}
```
