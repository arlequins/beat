import { imageIdFor } from "./image-id.js";

const DEFAULT_API_ORIGIN =
  "https://4kfwvp7y2qoprape5p2jr5qvra0ekgcl.lambda-url.ap-northeast-1.on.aws";
const ADMIN_URL = "https://arlequins.github.io/beat/admin/";
const ADMIN_TAB_PATTERNS = [
  "https://arlequins.github.io/beat/admin/*",
  "http://localhost:43100/admin/*",
];

function apiOrigin() {
  return DEFAULT_API_ORIGIN;
}

function sessionMessage(state) {
  switch (state) {
    case "missing-tab":
      return `Beat Admin 탭을 같은 Chrome 프로필에서 열어 주세요: ${ADMIN_URL}`;
    case "bridge-unavailable":
      return "Beat Admin 탭을 새로고침한 뒤 관리자 기록 목록이 보일 때 다시 시도해 주세요.";
    case "signed-out":
      return "Beat Admin에서 Google SSO를 완료하고 관리자 기록 목록이 보일 때 다시 시도해 주세요.";
    case "expired":
      return "Beat Admin 로그인 세션이 만료되었습니다. 관리자 탭을 새로고침하거나 다시 로그인해 주세요.";
    default:
      return "Beat 관리자 로그인 상태를 확인할 수 없습니다. 관리자 탭을 새로고침해 주세요.";
  }
}

async function inspectAdminSession() {
  const tabs = await chrome.tabs.query({ url: ADMIN_TAB_PATTERNS });
  if (tabs.length === 0)
    return { state: "missing-tab", message: sessionMessage("missing-tab") };
  let bridgeSeen = false;
  let sessionSeen = false;
  let expired = false;
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: "READ_BEAT_ADMIN_SESSION",
      });
      bridgeSeen = true;
      if (!result?.session) continue;
      sessionSeen = true;
      const session = JSON.parse(result.session);
      if (
        typeof session.accessToken === "string" &&
        session.accessToken.length > 20 &&
        typeof session.accessExpiresAt === "number" &&
        session.accessExpiresAt > Date.now()
      )
        return {
          state: "ready",
          message: "Beat Admin 로그인 세션을 확인했습니다.",
          token: session.accessToken,
        };
      if (typeof session.accessToken === "string") expired = true;
    } catch {
      // The tab may not have loaded the bridge yet. Try the next tab.
    }
  }
  const state = expired
    ? "expired"
    : sessionSeen
      ? "signed-out"
      : bridgeSeen
        ? "signed-out"
        : "bridge-unavailable";
  return { state, message: sessionMessage(state) };
}

async function readAdminAccessToken() {
  const session = await inspectAdminSession();
  if (session.state !== "ready" || !session.token)
    throw new Error(session.message);
  return session.token;
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
  const entries = await loadEntries();
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  let uploaded = 0;
  let skipped = 0;
  const clientRequestId = crypto.randomUUID();
  for (const assignment of assignments) {
    if (typeof assignment?.entryId !== "string") continue;
    const entry = entriesById.get(assignment.entryId);
    if (!entry)
      throw new Error(
        "선택한 Beat 초안을 찾을 수 없습니다. 목록을 다시 불러와 주세요.",
      );
    const existingImageIds = new Set(
      (entry.images ?? []).map((image) => image.id),
    );
    for (const image of assignment.images ?? []) {
      const imageId = await imageIdFor(assignment.entryId, image.contentBase64);
      if (existingImageIds.has(imageId)) {
        skipped += 1;
        continue;
      }
      await apiRequest(
        `/admin/gourmet/entries/${encodeURIComponent(assignment.entryId)}/images`,
        {
          body: JSON.stringify(image),
          clientRequestId,
          method: "POST",
        },
      );
      existingImageIds.add(imageId);
      uploaded += 1;
    }
  }
  return { skipped, uploaded };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === "LOAD_ENTRIES")
        return sendResponse({ ok: true, entries: await loadEntries() });
      if (message?.type === "CHECK_ADMIN_SESSION") {
        const session = await inspectAdminSession();
        return sendResponse({
          ok: true,
          session: { state: session.state, message: session.message },
        });
      }
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
