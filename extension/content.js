const defaultApiUrl = 'http://localhost:3004/api/analyze';

async function fetchScore(owner, repo, prNumber) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'analyze', owner, repo, prNumber },
      (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.data);
        }
      }
    );
  });
}

function injectScoreBadge(score, summary) {
  // Find the PR title element
  const titleElement = document.querySelector('.gh-header-title');
  if (!titleElement) return;

  const existingBadge = document.getElementById('chunkcheck-badge');
  if (existingBadge) existingBadge.remove();

  const badge = document.createElement('span');
  badge.id = 'chunkcheck-badge';
  badge.className = 'chunkcheck-badge';
  
  let color = '#2c974b'; // green
  if (score < 60) color = '#cb2431'; // red
  else if (score < 80) color = '#b08800'; // yellow
  
  badge.style.backgroundColor = color;
  badge.innerHTML = `<strong>ChunkCheck:</strong> ${score}/100 (${summary})`;

  titleElement.appendChild(badge);
}

async function run() {
  const match = window.location.pathname.match(/\\/([^\\/]+)\\/([^\\/]+)\\/pull\\/(\\d+)/);
  if (!match) return;

  const [, owner, repo, prNumber] = match;

  try {
    const data = await fetchScore(owner, repo, prNumber);
    injectScoreBadge(data.score, data.summary);
  } catch (error) {
    console.error('ChunkCheck Error:', error);
  }
}

// Run on initial load
run();

// GitHub uses Turbo/pjax, so we need to listen for page changes
document.addEventListener('pjax:end', run);
document.addEventListener('turbo:load', run);
