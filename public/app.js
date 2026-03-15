const form = document.getElementById("analyze-form");
const input = document.getElementById("pr-url");
const statusBox = document.getElementById("status");
const resultsSection = document.getElementById("results");
const scoreTitle = document.getElementById("score-title");
const scoreSummary = document.getElementById("score-summary");
const repoName = document.getElementById("repo-name");
const prLink = document.getElementById("pr-link");
const metricsGrid = document.getElementById("metrics-grid");
const strengthsList = document.getElementById("strengths-list");
const suggestionsList = document.getElementById("suggestions-list");
const analysisList = document.getElementById("analysis-list");
const loginForm = document.getElementById("login-form");
const githubLinkInput = document.getElementById("github-link");
const loginStatus = document.getElementById("login-status");
const topLoginLink = document.getElementById("top-login-link");
const scoreRing = document.getElementById("score-ring");
const scoreRingValue = document.getElementById("score-ring-value");
const badgeGrid = document.getElementById("badge-grid");
const improvementList = document.getElementById("improvement-list");
const trendSummary = document.getElementById("trend-summary");
const historyList = document.getElementById("history-list");
const clearHistoryButton = document.getElementById("clear-history-button");
const historyChart = document.getElementById("history-chart");

const METRIC_LABELS = {
  filesChanged: "Files Changed",
  additions: "Additions",
  deletions: "Deletions",
  linesChanged: "Lines Changed",
  testsDetected: "Tests Detected",
  ciStatus: "CI Status",
  commits: "Commits"
};

const SAVED_GITHUB_LINK_KEY = "chunkcheck.github-link";
const HISTORY_KEY = "chunkcheck.analysis-history";
const HISTORY_LIMIT = 8;

hydrateSavedGithubLink();

if (loginForm && githubLinkInput && loginStatus) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const githubLink = githubLinkInput.value.trim();

    if (!isValidGithubProfileLink(githubLink)) {
      setLoginStatus("Enter a valid GitHub profile link.", true);
      return;
    }

    localStorage.setItem(SAVED_GITHUB_LINK_KEY, githubLink);
    setLoginStatus(`Connected: ${githubLink}`);
    updateTopLoginLink(githubLink);
  });
}

if (form && input && statusBox) {
  renderHistory();

  if (clearHistoryButton) {
    clearHistoryButton.addEventListener("click", () => {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const url = input.value.trim();

    if (!url) {
      setStatus("Paste a GitHub Pull Request URL to continue.", true);
      return;
    }

    setStatus("Analyzing pull request...");

    if (resultsSection) {
      resultsSection.classList.add("hidden");
    }

    try {
      const response = await fetch(`/analyze?url=${encodeURIComponent(url)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to analyze this PR.");
      }

      saveHistoryEntry(payload);
      renderResults(payload);
      renderHistory(payload);
      setStatus("Analysis complete. Scroll down to review the report.");

      if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      setStatus(error.message, true);
    }
  });
}

function renderResults(payload) {
  if (
    !scoreTitle ||
    !scoreSummary ||
    !repoName ||
    !prLink ||
    !metricsGrid ||
    !strengthsList ||
    !suggestionsList ||
    !analysisList ||
    !resultsSection
  ) {
    return;
  }

  scoreTitle.textContent = `${payload.score} / 100`;
  scoreSummary.textContent = payload.summary;
  repoName.textContent = payload.repository;
  prLink.href = payload.pullRequest.url;
  prLink.textContent = payload.pullRequest.title || "Open pull request";

  renderScoreRing(payload.score);
  renderBadges(payload.metrics, payload.score);
  renderImprovementPlan(payload);

  metricsGrid.innerHTML = "";
  Object.entries(payload.metrics).forEach(([key, value]) => {
    const card = document.createElement("article");
    card.className = "metric-card";
    card.innerHTML = `
      <div class="metric-label">${METRIC_LABELS[key] || key}</div>
      <div class="metric-value">${value}</div>
    `;
    metricsGrid.appendChild(card);
  });

  fillList(strengthsList, payload.strengths, "No strengths were detected yet.");
  fillList(suggestionsList, payload.suggestions, "No improvements suggested.");
  fillList(analysisList, payload.analysis, "No risk signals found.");

  resultsSection.classList.remove("hidden");
}

function renderScoreRing(score) {
  if (!scoreRing || !scoreRingValue) {
    return;
  }

  scoreRing.style.setProperty("--score", score);
  scoreRing.dataset.tier = getScoreTier(score);
  scoreRingValue.textContent = score;
}

function renderBadges(metrics, score) {
  if (!badgeGrid) {
    return;
  }

  const badges = [
    {
      label: "Score tier",
      value: getScoreTierLabel(score),
      tone: getScoreTier(score)
    },
    {
      label: "Tests",
      value: metrics.testsDetected,
      tone: metrics.testsDetected === "Yes" ? "good" : "warn"
    },
    {
      label: "CI",
      value: metrics.ciStatus,
      tone:
        metrics.ciStatus === "Passing"
          ? "good"
          : metrics.ciStatus === "Failing"
            ? "danger"
            : "warn"
    },
    {
      label: "PR Size",
      value: classifyPrSize(metrics.linesChanged, metrics.filesChanged),
      tone: metrics.linesChanged > 500 || metrics.filesChanged > 10 ? "warn" : "good"
    }
  ];

  badgeGrid.innerHTML = "";
  badges.forEach((badge) => {
    const item = document.createElement("div");
    item.className = `status-badge tone-${badge.tone}`;
    item.innerHTML = `
      <span class="status-badge-label">${badge.label}</span>
      <strong>${badge.value}</strong>
    `;
    badgeGrid.appendChild(item);
  });
}

function renderImprovementPlan(payload) {
  if (!improvementList) {
    return;
  }

  const plan = buildImprovementPlan(payload);
  fillList(improvementList, plan, "This PR already looks strong. Keep the scope focused and the CI green.");
}

function buildImprovementPlan(payload) {
  const items = [];
  const { metrics } = payload;

  if (metrics.testsDetected === "No") {
    items.push("Add at least one targeted automated test that proves the changed behavior.");
  }

  if (metrics.ciStatus !== "Passing") {
    items.push("Get all CI checks to passing before asking for review.");
  }

  if (Number(metrics.linesChanged) > 500 || Number(metrics.filesChanged) > 10) {
    items.push("Reduce review scope by splitting this work into smaller PRs.");
  }

  if (payload.suggestions.some((entry) => entry.toLowerCase().includes("documentation"))) {
    items.push("Update documentation, changelog, or release notes for visible behavior changes.");
  }

  if (payload.suggestions.some((entry) => entry.toLowerCase().includes("commit"))) {
    items.push("Rewrite vague commit messages so each one explains the behavior change clearly.");
  }

  payload.suggestions.forEach((entry) => {
    if (items.length < 5 && !items.includes(entry)) {
      items.push(entry);
    }
  });

  return items.slice(0, 5);
}

function renderHistory(latestPayload = null) {
  const history = loadHistory();

  if (historyList) {
    historyList.innerHTML = "";

    if (history.length === 0) {
      historyList.innerHTML = `<div class="history-empty">No PR history yet. Analyze a PR to start tracking your progress.</div>`;
    } else {
      history.forEach((entry, index) => {
        const item = document.createElement("article");
        item.className = "history-item";
        item.innerHTML = `
          <div class="history-score ${getScoreTier(entry.score)}">${entry.score}</div>
          <div class="history-copy">
            <strong>${entry.repository}</strong>
            <span>${entry.title}</span>
            <small>${formatHistoryMeta(entry)}</small>
          </div>
          <div class="history-trend">${index === 0 ? "Latest" : compareEntry(entry, history[index - 1])}</div>
        `;
        historyList.appendChild(item);
      });
    }
  }

  if (trendSummary) {
    trendSummary.textContent = buildTrendSummary(history, latestPayload);
  }

  renderHistoryChart(history);
}

function buildTrendSummary(history, latestPayload) {
  if (history.length < 2) {
    return "Analyze a few PRs to see whether your quality is improving over time.";
  }

  const latest = history[0];
  const previous = history[1];
  const delta = latest.score - previous.score;

  if (delta > 0) {
    return `You are improving. Your latest PR scored ${delta} points higher than the previous one. Keep the same review discipline.`;
  }

  if (delta < 0) {
    return `Your latest PR dropped by ${Math.abs(delta)} points compared with the previous analysis. Focus on the improvement plan before opening review.`;
  }

  if (latestPayload) {
    return "Your score is stable. To keep improving, reduce avoidable review risk like missing docs, failing CI, or large diffs.";
  }

  return "Your recent PR scores are stable. Use the improvement plan to push the next one higher.";
}

function saveHistoryEntry(payload) {
  const history = loadHistory().filter((entry) => entry.url !== payload.pullRequest.url);
  const entry = {
    url: payload.pullRequest.url,
    repository: payload.repository,
    title: payload.pullRequest.title,
    score: payload.score,
    summary: payload.summary,
    ciStatus: payload.metrics.ciStatus,
    testsDetected: payload.metrics.testsDetected,
    filesChanged: payload.metrics.filesChanged,
    linesChanged: payload.metrics.linesChanged,
    analyzedAt: new Date().toISOString()
  };

  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_error) {
    return [];
  }
}

function compareEntry(entry, previousEntry) {
  if (!previousEntry) {
    return "Baseline";
  }

  const delta = entry.score - previousEntry.score;
  if (delta > 0) {
    return `+${delta}`;
  }

  if (delta < 0) {
    return `${delta}`;
  }

  return "0";
}

function formatHistoryMeta(entry) {
  return `${entry.linesChanged} lines changed • ${entry.testsDetected} tests • ${entry.ciStatus} CI`;
}

function classifyPrSize(linesChanged, filesChanged) {
  if (linesChanged > 800 || filesChanged > 15) return "Large";
  if (linesChanged > 300 || filesChanged > 7) return "Medium";
  return "Compact";
}

function renderHistoryChart(history) {
  if (!historyChart) {
    return;
  }

  historyChart.innerHTML = "";

  if (history.length === 0) {
    historyChart.innerHTML = `<div class="history-chart-empty">No chart yet. Analyze PRs to build your score graph.</div>`;
    return;
  }

  const latestEntries = [...history].reverse();

  latestEntries.forEach((entry) => {
    const column = document.createElement("div");
    column.className = "chart-column";
    column.innerHTML = `
      <div class="chart-bar-wrap">
        <div class="chart-bar ${getScoreTier(entry.score)}" style="--bar-height:${Math.max(entry.score, 8)}%;"></div>
      </div>
      <span class="chart-score">${entry.score}</span>
    `;
    historyChart.appendChild(column);
  });
}

function getScoreTier(score) {
  if (score >= 85) return "good";
  if (score >= 65) return "warn";
  return "danger";
}

function getScoreTierLabel(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Watchlist";
  return "Risky";
}

function fillList(element, items, fallbackText) {
  if (!element) {
    return;
  }

  element.innerHTML = "";

  if (!items || items.length === 0) {
    const item = document.createElement("li");
    item.textContent = fallbackText;
    element.appendChild(item);
    return;
  }

  items.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    element.appendChild(item);
  });
}

function setStatus(message, isError = false) {
  if (!statusBox) {
    return;
  }

  statusBox.textContent = message;
  statusBox.className = isError ? "status error" : "status";
}

function setLoginStatus(message, isError = false) {
  if (!loginStatus) {
    return;
  }

  loginStatus.textContent = message;
  loginStatus.className = isError ? "login-status error" : "login-status";
}

function hydrateSavedGithubLink() {
  const savedLink = localStorage.getItem(SAVED_GITHUB_LINK_KEY);

  if (!savedLink) {
    return;
  }

  if (githubLinkInput) {
    githubLinkInput.value = savedLink;
  }

  if (loginStatus) {
    setLoginStatus(`Connected: ${savedLink}`);
  }

  updateTopLoginLink(savedLink);
}

function isValidGithubProfileLink(value) {
  try {
    const parsed = new URL(value);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parsed.hostname === "github.com" && parts.length === 1;
  } catch (_error) {
    return false;
  }
}

function updateTopLoginLink(savedLink) {
  if (!topLoginLink) {
    return;
  }

  if (!savedLink) {
    topLoginLink.href = "/login.html";
    topLoginLink.removeAttribute("target");
    topLoginLink.removeAttribute("rel");
    topLoginLink.classList.remove("is-connected");
    topLoginLink.textContent = "Login";
    return;
  }

  topLoginLink.href = savedLink;
  topLoginLink.target = "_blank";
  topLoginLink.rel = "noreferrer";
  topLoginLink.classList.add("is-connected");
  topLoginLink.setAttribute("aria-label", "Open connected GitHub profile");
  topLoginLink.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="github-icon">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.2-.02-2.17-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.78 1.19 1.78 1.19 1.03 1.77 2.69 1.26 3.35.96.1-.75.4-1.26.72-1.55-2.55-.29-5.23-1.28-5.23-5.67 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.03 0 0 .97-.31 3.17 1.17a10.93 10.93 0 0 1 5.77 0c2.2-1.48 3.17-1.17 3.17-1.17.62 1.57.23 2.74.11 3.03.73.8 1.18 1.82 1.18 3.07 0 4.4-2.68 5.37-5.24 5.66.41.35.78 1.04.78 2.11 0 1.52-.01 2.74-.01 3.11 0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" fill="currentColor"/>
    </svg>
  `;
}
