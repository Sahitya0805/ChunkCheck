document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const repoInput = document.getElementById("repoInput");
  const tokenInput = document.getElementById("tokenInput");
  const loading = document.getElementById("loading");
  const chartPanel = document.getElementById("chartPanel");
  const prsList = document.getElementById("prsList");
  const prsContainer = document.getElementById("prsContainer");
  
  let chartInstance = null;

  analyzeBtn.addEventListener("click", async () => {
    const repoStr = repoInput.value.trim();
    if (!repoStr.includes('/')) {
      alert("Please enter a valid owner/repo string.");
      return;
    }
    
    const [owner, repo] = repoStr.split('/');
    const token = tokenInput.value.trim();
    if (token) localStorage.setItem("chunkcheck_gh_token", token);
    
    const headers = token ? { "x-github-token": token } : {};
    
    // UI states
    loading.style.display = "block";
    chartPanel.style.display = "none";
    prsList.style.display = "none";
    prsContainer.innerHTML = "";
    
    try {
      // 1. Fetch recent PRs
      const prsResponse = await fetch(`/api/repo-prs?owner=${owner}&repo=${repo}`, { headers });
      if (!prsResponse.ok) {
        const errData = await prsResponse.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch repository PRs (${prsResponse.status})`);
      }
      
      const prs = await prsResponse.json();
      
      if (prs.length === 0) {
        alert("No recent merged PRs found.");
        loading.style.display = "none";
        return;
      }

      // 2. Analyze each PR
      const analysisPromises = prs.map(async (pr) => {
        try {
          const res = await fetch(`/api/analyze?owner=${owner}&repo=${repo}&pr=${pr.number}`, { headers });
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
      
      const results = await Promise.all(analysisPromises);
      
      // 3. Render chart
      const validResults = results.filter(r => r.score !== null).reverse(); // Oldest to newest
      if (validResults.length > 0) {
        renderChart(validResults);
        chartPanel.style.display = "block";
      } else {
        // If all failed, show an error alert, likely rate limiting
        const errorMsg = results[0]?.error || "Failed to analyze any PRs";
        alert(`Analysis failed. Reason: ${errorMsg}`);
      }
      
      // 4. Render list
      renderList(results);
      
      loading.style.display = "none";
      prsList.style.display = "block";
      
    } catch (err) {
      console.error(err);
      alert("An error occurred: " + err.message);
      loading.style.display = "none";
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
    Chart.defaults.color = '#d8d3bf';
    Chart.defaults.font.family = '"IBM Plex Sans", sans-serif';
    
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'PR Quality Score',
          data: scores,
          borderColor: '#4f6f3a',
          backgroundColor: 'rgba(79, 111, 58, 0.2)',
          borderWidth: 3,
          pointBackgroundColor: '#b48e3d',
          pointBorderColor: '#1a1f19',
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(26, 31, 25, 0.9)',
            titleColor: '#efe9d7',
            bodyColor: '#d8d3bf',
            borderColor: '#5f6c4f',
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
              color: 'rgba(95, 108, 79, 0.2)'
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
  
  function renderList(results) {
    results.forEach(pr => {
      const el = document.createElement("div");
      el.className = "pr-item";
      
      let scoreHtml = '';
      if (pr.score !== null) {
        scoreHtml = `<div class="pr-score">${pr.score}/100</div>`;
      } else {
        scoreHtml = `<div class="pr-score" style="background:#8e4f3b; max-width: 300px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${pr.error}">Failed: ${pr.error}</div>`;
      }
      
      el.innerHTML = `
        <div>
          <a href="${pr.url}" target="_blank">#${pr.number} - ${pr.title}</a>
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
