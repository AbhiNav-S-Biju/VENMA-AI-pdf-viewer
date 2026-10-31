const WORKSPACE_URL = "workspace.html";

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL(WORKSPACE_URL);
  await chrome.tabs.create({ url });
});
