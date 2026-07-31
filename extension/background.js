chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze') {
    chrome.storage.sync.get(['apiUrl'], async (result) => {
      const apiUrl = result.apiUrl || 'http://localhost:3004/api/analyze';
      
      try {
        const url = `${apiUrl}?owner=${request.owner}&repo=${request.repo}&pr=${request.prNumber}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const data = await response.json();
        sendResponse({ data });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    });

    return true; // Indicates async response
  }
});
