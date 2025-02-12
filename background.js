chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
      conversations: [],
      maxHistoryLimit: 50 // Maximum number of messages to store per conversation
    });
  });