// ============================================================
// Background Service Worker
// Watches for IRCTC tab URL changes to support SPA navigation.
// Sends a message to the content script when IRCTC pages change.
// ============================================================

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.url && tab.url.includes('irctc.co.in')) {
        chrome.tabs.sendMessage(tabId, {
            type: 'URL_CHANGED',
            url: changeInfo.url
        }).catch(() => {
            // Content script may not be ready yet — safe to ignore
        });
    }
});
