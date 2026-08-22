const state = {
  entries: [],
  groups: [],
};

const $ = (selector) => document.querySelector(selector);

function status(message, isError = false) {
  const node = $("#status");
  node.textContent = message;
  node.style.color = isError ? "#b91c1c" : "#92400e";
}

function send(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError)
        return resolve({ ok: false, error: chrome.runtime.lastError.message });
      resolve(response ?? { ok: false, error: "응답이 없습니다." });
    });
  });
}

function tokens(value) {
  return String(value ?? "")
    .toLocaleLowerCase("ko-KR")
    .replace(/미상|unknown|none/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2);
}

function matchScore(entry, text) {
  const haystack = String(text ?? "").toLocaleLowerCase("ko-KR");
  const fields = [
    entry.restaurantName,
    entry.menuName,
    entry.summary,
    ...(entry.tasteNotes ?? []),
  ];
  let score = 0;
  for (const field of fields) {
    const normalized = String(field ?? "")
      .toLocaleLowerCase("ko-KR")
      .trim();
    if (!normalized || normalized === "미상") continue;
    if (haystack.includes(normalized)) score += 8;
    for (const token of tokens(normalized))
      if (haystack.includes(token)) score += 1;
  }
  const rating = String(entry.rating);
  if (new RegExp(`(?:^|\\s)${rating}(?:점|\\s|$)`).test(text)) score += 3;
  return score;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  const groups = $("#groups");
  groups.innerHTML = state.groups
    .map((group, index) => {
      const options = state.entries
        .map(
          (entry) =>
            `<option value="${escapeHtml(entry.id)}" ${entry.id === group.entryId ? "selected" : ""}>${escapeHtml(entry.restaurantName)} · ${escapeHtml(entry.menuName)} (${entry.rating})</option>`,
        )
        .join("");
      const thumbs = group.images
        .map(
          (image) =>
            `<img src="data:${image.contentType};base64,${image.contentBase64}" alt="" />`,
        )
        .join("");
      return `<div class="group"><div class="group-title">${index + 1}번째 사진 묶음 · ${group.images.length}장</div><div class="group-text">${escapeHtml(group.text || "텍스트 없음")}</div><div class="thumbs">${thumbs}</div><label for="entry-${index}">연결할 Beat 초안</label><select id="entry-${index}" data-group="${index}">${options}</select></div>`;
    })
    .join("");
  $("#results").classList.toggle("hidden", state.groups.length === 0);
  $("#summary").textContent =
    `${state.groups.reduce((sum, group) => sum + group.images.length, 0)}장의 사진을 찾았습니다. 연결 대상을 확인한 뒤 저장하세요.`;
  for (const select of groups.querySelectorAll("select[data-group]"))
    select.addEventListener("change", () => {
      state.groups[Number(select.dataset.group)].entryId = select.value;
    });
}

async function loadEntries() {
  const response = await send({ type: "LOAD_ENTRIES" });
  if (!response.ok) throw new Error(response.error);
  state.entries = response.entries;
  if (state.entries.length === 0)
    throw new Error(
      "연결할 Beat 초안이 없습니다. 먼저 Gourmet 기록을 draft로 저장해 주세요.",
    );
}

$("#extract").addEventListener("click", async () => {
  $("#extract").disabled = true;
  status("Beat 초안과 ChatGPT 사진을 확인하는 중입니다…");
  try {
    await loadEntries();
    const response = await send({ type: "EXTRACT_CONVERSATION" });
    if (!response.ok) throw new Error(response.error);
    if (response.data?.error) throw new Error(response.data.error);
    state.groups = (response.data?.messages ?? []).map((message) => {
      const ranked = state.entries
        .map((entry) => ({ entry, score: matchScore(entry, message.text) }))
        .sort((left, right) => right.score - left.score);
      return {
        entryId: ranked[0]?.entry.id ?? state.entries[0].id,
        images: message.images,
        text: message.text,
      };
    });
    if (state.groups.length === 0)
      throw new Error("현재 대화에서 읽을 수 있는 사진을 찾지 못했습니다.");
    render();
    status("자동 연결 후보를 만들었습니다. 대상만 확인해 주세요.");
  } catch (error) {
    status(
      error instanceof Error ? error.message : "사진을 읽지 못했습니다.",
      true,
    );
  } finally {
    $("#extract").disabled = false;
  }
});

$("#export").addEventListener("click", async () => {
  $("#export").disabled = true;
  status("Beat에 사진을 연결하는 중입니다…");
  try {
    const grouped = new Map();
    for (const group of state.groups) {
      if (!group.entryId) continue;
      const current = grouped.get(group.entryId) ?? [];
      current.push(...group.images);
      grouped.set(group.entryId, current);
    }
    const assignments = [...grouped].map(([entryId, images]) => ({
      entryId,
      images,
    }));
    const response = await send({ type: "EXPORT_ASSIGNMENTS", assignments });
    if (!response.ok) throw new Error(response.error);
    status(`${response.result.uploaded}장의 사진을 Beat 초안에 연결했습니다.`);
    $("#export").disabled = true;
  } catch (error) {
    status(
      error instanceof Error ? error.message : "사진 연결에 실패했습니다.",
      true,
    );
    $("#export").disabled = false;
  }
});
