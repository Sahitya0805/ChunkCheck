function parsePullRequestUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (parsed.hostname !== "github.com" || parts.length < 4 || parts[2] !== "pull") {
      throw new Error("Invalid GitHub pull request URL");
    }

    const prNumber = Number(parts[3]);

    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      throw new Error("Invalid pull request number");
    }

    return {
      owner: parts[0],
      repo: parts[1],
      prNumber
    };
  } catch (error) {
    throw new Error(`Unable to parse PR URL: ${error.message}`);
  }
}

module.exports = {
  parsePullRequestUrl
};
