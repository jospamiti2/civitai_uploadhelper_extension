chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "showOptions") {
    chrome.runtime.openOptionsPage();
  }
});