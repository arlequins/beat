const DEFAULT_API_ORIGIN =
  "https://4kfwvp7y2qoprape5p2jr5qvra0ekgcl.lambda-url.ap-northeast-1.on.aws";
const ADMIN_TAB_PATTERNS = [
  "https://arlequins.github.io/beat/admin/*",
  "http://localhost:43100/admin/*",
];

function apiOrigin() {
  return DEFAULT_API_ORIGIN;
}

async function readAdminAccessToken() {
  const tabs = await chrome.tabs.query({ url: ADMIN_TAB_PATTERNS });
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: "READ_BEAT_ADMIN_SESSION",
      });
      if (!result?.session) continue;
      const session = JSON.parse(result.session);
      if (
        typeof session.accessToken === "string" &&
        session.accessToken.length > 20 &&
        typeof session.accessExpiresAt === "number" &&
        session.accessExpiresAt > Date.now()
      )
        return session.accessToken;
    } catch {
      // The tab may not have loaded the bridge yet. Try the next tab.
    }
  }
  throw new Error("Beat 관리자 화면에서 먼저 로그인해 주세요.");
}

async function apiRequest(path, init = {}, clientRequestId) {
  const token = await readAdminAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (clientRequestId) headers.set("X-Client-Request-Id", clientRequestId);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiOrigin()}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    let message = `Beat API 요청 실패 (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.error?.message === "string")
        message = body.error.message;
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(message);
  }
  return response.json();
}

async function loadEntries() {
  const result = await apiRequest(
    "/api/gourmet/entries?status=draft&pageSize=100",
  );
  return Array.isArray(result?.entries) ? result.entries : [];
}

async function activeChatGptTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const tab = tabs[0];
  if (
    !tab?.id ||
    !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url ?? "")
  )
    throw new Error("ChatGPT 대화를 활성 탭으로 열어 주세요.");
  return tab.id;
}

async function extractConversation() {
  const tabId = await activeChatGptTab();
  return chrome.tabs.sendMessage(tabId, { type: "EXTRACT_CHATGPT_MEDIA" });
}

async function exportAssignments(assignments) {
  if (!Array.isArray(assignments) || assignments.length === 0)
    throw new Error("연결할 사진을 선택해 주세요.");
  let uploaded = 0;
  const clientRequestId = crypto.randomUUID();
  for (const assignment of assignments) {
    if (typeof assignment?.entryId !== "string") continue;
    for (const image of assignment.images ?? []) {
      await apiRequest(
        `/admin/gourmet/entries/${encodeURIComponent(assignment.entryId)}/images`,
        {
          body: JSON.stringify(image),
          clientRequestId,
          method: "POST",
        },
      );
      uploaded += 1;
    }
  }
  return { uploaded };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === "LOAD_ENTRIES")
        return sendResponse({ ok: true, entries: await loadEntries() });
      if (message?.type === "EXTRACT_CONVERSATION")
        return sendResponse({ ok: true, data: await extractConversation() });
      if (message?.type === "EXPORT_ASSIGNMENTS")
        return sendResponse({
          ok: true,
          result: await exportAssignments(message.assignments),
        });
      return sendResponse({ ok: false, error: "지원하지 않는 요청입니다." });
    } catch (error) {
      return sendResponse({
        ok: false,
        error:
          error instanceof Error ? error.message : "내보내기에 실패했습니다.",
      });
    }
  })();
  return true;
});
