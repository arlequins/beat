chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "READ_BEAT_ADMIN_SESSION") return undefined;
  sendResponse({
    session: window.localStorage.getItem("beat-admin-session"),
  });
  return true;
});
