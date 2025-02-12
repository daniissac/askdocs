function extractMainContent() {
    // Common selectors for documentation sites
    const docSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.main-content',
      '.documentation',
      '.content',
      '.markdown-body', // GitHub
      '.documentation-content', // ReadTheDocs
      '#readme', // GitHub READMEs
      '.devsite-article-body', // Google Docs
      '.docs-content' // Various docs
    ];
  
    let content = '';
    
    // Try each selector until we find content
    for (const selector of docSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        content = element.innerText;
        break;
      }
    }
  
    // Fallback: if no content found with selectors, get body text
    if (!content) {
      content = document.body.innerText;
    }
  
    // Clean up the content
    content = content
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000); // Limit content length
  
    return content;
  }
  
  // Expose function for message passing
  window.extractMainContent = extractMainContent;
  
  // background.js
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getDocContent") {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        try {
          const [tab] = tabs;
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: extractMainContent
          });
          
          sendResponse({ content: results[0].result });
        } catch (error) {
          console.error('Error extracting content:', error);
          sendResponse({ error: 'Failed to extract content' });
        }
      });
      return true; // Required for async response
    }
  });
  