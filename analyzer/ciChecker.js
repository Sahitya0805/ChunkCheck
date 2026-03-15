function checkCIStatus(statusResponse, checkRunsResponse) {
  const checkRuns = checkRunsResponse?.check_runs || [];
  const statusState = statusResponse?.state;

  if (checkRuns.length > 0) {
    const hasFailure = checkRuns.some((run) =>
      ["failure", "timed_out", "cancelled", "action_required"].includes(
        run.conclusion
      )
    );

    if (hasFailure) {
      return { summary: "failing" };
    }

    const allCompleted = checkRuns.every((run) => run.status === "completed");
    const allSuccessful = checkRuns.every((run) =>
      ["success", "neutral", "skipped"].includes(run.conclusion)
    );

    if (allCompleted && allSuccessful) {
      return { summary: "passing" };
    }

    return { summary: "pending" };
  }

  if (statusState === "success") {
    return { summary: "passing" };
  }

  if (statusState === "failure" || statusState === "error") {
    return { summary: "failing" };
  }

  if (statusState === "pending") {
    return { summary: "pending" };
  }

  return { summary: "unknown" };
}

module.exports = checkCIStatus;
