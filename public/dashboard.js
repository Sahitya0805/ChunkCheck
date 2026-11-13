// Highlight the current page in the top navigation
(function markCurrentNav() {
  const page = window.location.pathname.includes("dashboard") ? "dashboard" : window.location.pathname.includes("analyze") ? "analyze" : null;
  if (!page) return;
  const link = document.querySelector(`.top-nav a[data-nav="${page}"]`);
  if (link) link.setAttribute("aria-current", "page");
})();

document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const repoInput = document.getElementById("repoInput");
  const tokenInput = document.getElementById("tokenInput");
  const loading = document.getElementById("loading");
  const chartPanel = document.getElementById("chartPanel");
  const prsList = document.getElementById("prsList");
  const prsContainer = document.getElementById("prsContainer");
  
  const dashError = document.getElementById("dashError");
  const summaryPanel = document.getElementById("summaryPanel");
  let chartInstance = null;

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const showError = (message) => {
    dashError.textContent = message;
    dashError.hidden = !message;
  };

  // Accepts "owner/repo" or any github.com repo URL.
  const parseRepo = (value) => {
    const cleaned = value.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\.git$/i, "");
    const [owner, repo] = cleaned.split("/").filter(Boolean);
    return owner && repo ? { owner, repo } : null;
  };

  // Run async jobs with a small concurrency limit to stay friendly to the GitHub API.
  const mapLimited = async (items, limit, fn) => {
    const results = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    });
    await Promise.all(workers);
    return results;
  };

  analyzeBtn.addEventListener("click", async () => {
    showError("");
    const parsedRepo = parseRepo(repoInput.value);
    if (!parsedRepo) {
      showError("Enter a repository as owner/repo, for example checkstyle/checkstyle.");
      return;
    }

    const { owner, repo } = parsedRepo;
    const token = tokenInput.value.trim();
    if (token) localStorage.setItem("chunkcheck_gh_token", token);
    
    const headers = token ? { "x-github-token": token } : {};
    
    // UI states
    loading.style.display = "block";
    summaryPanel.hidden = true;
    analyzeBtn.disabled = true;
    chartPanel.style.display = "none";
    prsList.style.display = "none";
    prsContainer.innerHTML = "";
    
    try {
      // 1. Fetch recent PRs
      const prsResponse = await fetch(`/api/repo-prs?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`, { headers });
      if (!prsResponse.ok) {
        const errData = await prsResponse.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch repository PRs (${prsResponse.status})`);
      }
      
      const prs = await prsResponse.json();
      
      if (prs.length === 0) {
        showError("No recently merged pull requests were found in this repository.");
        return;
      }

      // 2. Analyze each PR
      const results = await mapLimited(prs, 3, async (pr) => {
        try {
          const res = await fetch(`/api/analyze?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&pr=${pr.number}`, { headers });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP error ${res.status}`);
          }
          const data = await res.json();
          return { ...pr, score: data.score, summary: data.summary };
        } catch (e) {
          return { ...pr, score: null, error: e.message };
        }
      });
      
      // 3. Render chart
      const validResults = results.filter(r => r.score !== null).reverse(); // Oldest to newest
      if (validResults.length > 0) {
        // Show the panel first so Chart.js can measure its real size
        chartPanel.style.display = "block";
        renderChart(validResults);
        renderSummary(validResults);
      } else {
        // Usually the GitHub API rate limit
        const errorMsg = results[0]?.error || "Failed to analyze any PRs";
        showError(`Analysis failed: ${errorMsg}. Adding a GitHub token raises the rate limit.`);
      }
      
      // 4. Render list
      renderList(results);
      
      prsList.style.display = "block";
    } catch (err) {
      console.error(err);
      showError(err.message);
    } finally {
      loading.style.display = "none";
      analyzeBtn.disabled = false;
    }
  });
  
  function renderChart(data) {
    const ctx = document.getElementById('trendsChart').getContext('2d');
    
    if (chartInstance) {
      chartInstance.destroy();
    }
    
    const labels = data.map(d => `#${d.number}`);
    const scores = data.map(d => d.score);
    
    // Set chart defaults for dark mode
    Chart.defaults.color = '#3d3a34';
    Chart.defaults.font.family = '"Space Mono", monospace';
    
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'PR Quality Score',
          data: scores,
          borderColor: '#141414',
          backgroundColor: 'rgba(255, 225, 77, 0.55)',
          borderWidth: 3,
          pointBackgroundColor: '#ffe14d',
          pointBorderColor: '#141414',
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          tension: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#141414',
            titleColor: '#ffe14d',
            bodyColor: '#f4efe4',
            borderColor: '#141414',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              title: (items) => {
                const item = items[0];
                return `Pull Request ${item.label}`;
              },
              label: (item) => {
                const pr = data[item.dataIndex];
                return `Score: ${item.raw} (${pr.summary})`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(20, 20, 20, 0.12)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }
  
  function renderSummary(data) {
    const scores = data.map((d) => d.score);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const best = data.reduce((a, b) => (b.score > a.score ? b : a));
    const worst = data.reduce((a, b) => (b.score < a.score ? b : a));
    const half = Math.floor(scores.length / 2) || 1;
    const older = scores.slice(0, half);
    const newer = scores.slice(-half);
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const delta = Math.round(mean(newer) - mean(older));

    document.getElementById("avgScore").textContent = `${avg}/100`;
    document.getElementById("bestScore").textContent = `${best.score} (#${best.number})`;
    document.getElementById("worstScore").textContent = `${worst.score} (#${worst.number})`;
    document.getElementById("trendValue").textContent =
      scores.length < 2 ? "-" : delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "● steady";
    summaryPanel.hidden = false;
  }

  function renderList(results) {
    results.forEach(pr => {
      const el = document.createElement("div");
      el.className = "pr-item";
      
      let scoreHtml = '';
      if (pr.score !== null) {
        scoreHtml = `<div class="pr-score">${pr.score}/100</div>`;
      } else {
        scoreHtml = `<div class="pr-score" style="background:#ffd0d0; max-width: 300px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${escapeHtml(pr.error)}">Failed: ${escapeHtml(pr.error)}</div>`;
      }
      
      el.innerHTML = `
        <div>
          <a href="${escapeHtml(pr.url)}" target="_blank" rel="noopener">#${pr.number} - ${escapeHtml(pr.title)}</a>
          <div style="font-size: 0.8rem; margin-top: 5px; opacity: 0.7;">Merged: ${new Date(pr.merged_at).toLocaleDateString()}</div>
        </div>
        ${scoreHtml}
      `;
      prsContainer.appendChild(el);
    });
  }

  // Load saved token on startup
  const savedToken = localStorage.getItem("chunkcheck_gh_token");
  if (savedToken) {
    tokenInput.value = savedToken;
  }
});
