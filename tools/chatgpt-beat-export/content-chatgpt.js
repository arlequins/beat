const MAX_IMAGE_BYTES = 700 * 1024;
const MIN_IMAGE_EDGE = 48;
const ATTACHMENT_SOURCE = /\/(?:backend-api|api)\/.*(?:file|image|download)/i;

function imageSource(image) {
  return (
    image.currentSrc ||
    image.src ||
    image.dataset.src ||
    image.dataset.original ||
    image.getAttribute("data-src") ||
    ""
  );
}

function uniqueNodes(nodes) {
  return [...new Set(nodes)];
}

function imageNodes(node) {
  return [...node.querySelectorAll("img")].filter((image) => {
    const source = imageSource(image);
    if (!source || source.startsWith("data:image/svg+xml")) return false;
    if (image.closest('[data-message-author-role="assistant"]')) return false;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (
      width > 0 &&
      height > 0 &&
      Math.min(width, height) < MIN_IMAGE_EDGE &&
      !ATTACHMENT_SOURCE.test(source)
    )
      return false;
    const label = `${image.alt} ${image.className}`.toLowerCase();
    return !/(avatar|logo|favicon|icon)/.test(label);
  });
}

function userMessageNodes() {
  const byRole = [
    ...document.querySelectorAll('[data-message-author-role="user"]'),
  ];
  const directMatches = byRole.filter((node) => imageNodes(node).length > 0);
  if (directMatches.length > 0) return directMatches;

  const articles = [
    ...document.querySelectorAll(
      'main article, [data-testid^="conversation-turn-"]',
    ),
  ];
  const nestedUsers = articles.flatMap((article) =>
    [...article.querySelectorAll('[data-message-author-role="user"]')].filter(
      (node) => imageNodes(node).length > 0,
    ),
  );
  const fallbackArticles = articles.filter((article) => {
    const role = article
      .querySelector("[data-message-author-role]")
      ?.getAttribute("data-message-author-role");
    return role !== "assistant" && imageNodes(article).length > 0;
  });
  return uniqueNodes([...nestedUsers, ...fallbackArticles]);
}

async function waitForImage(image) {
  if (image.complete && image.naturalWidth > 0) return;
  await new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 2_000);
    image.addEventListener(
      "load",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

async function imageToPayload(image, index) {
  await waitForImage(image);
  const source = imageSource(image);
  if (!source) throw new Error("이미지 주소가 없습니다.");
  const response = await fetch(source, { credentials: "include" });
  if (!response.ok)
    throw new Error(`이미지를 읽지 못했습니다 (${response.status}).`);
  const sourceBlob = await response.blob();
  const bitmap = await createImageBitmap(sourceBlob, {
    imageOrientation: "from-image",
  });
  let scale = Math.min(1, 1_600 / Math.max(bitmap.width, bitmap.height));
  let quality = 0.84;
  let output = null;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    output = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (output && output.size <= MAX_IMAGE_BYTES) break;
    quality = Math.max(0.58, quality - 0.08);
    scale *= 0.84;
  }
  bitmap.close();
  if (!output || output.size > MAX_IMAGE_BYTES)
    throw new Error("이미지를 업로드 가능한 크기로 줄이지 못했습니다.");
  const bytes = new Uint8Array(await output.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  return {
    altText: image.alt?.trim() || `ChatGPT 대화 이미지 ${index + 1}`,
    contentBase64: btoa(binary),
    contentType: "image/webp",
    originalFilename: `chatgpt-meal-${index + 1}.webp`,
  };
}

async function extract() {
  const nodes = userMessageNodes();
  const visibleImageCount = imageNodes(document).length;
  const messages = [];
  let imageIndex = 0;
  for (const node of nodes) {
    const images = [];
    for (const image of imageNodes(node)) {
      try {
        images.push(await imageToPayload(image, imageIndex));
        imageIndex += 1;
      } catch {
        // Keep the text and other images exportable when one attachment is unavailable.
      }
    }
    if (images.length > 0)
      messages.push({
        text: (node.innerText || "").trim().slice(0, 4_000),
        images,
      });
  }
  return {
    diagnostics: {
      imageBearingMessageCount: messages.length,
      userMessageCount: nodes.length,
      visibleImageCount,
    },
    title: document.title.replace(/\s*[|·-]\s*ChatGPT.*$/i, "").trim(),
    url: window.location.href,
    messages,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_CHATGPT_MEDIA") return undefined;
  extract()
    .then((data) => sendResponse(data))
    .catch((error) =>
      sendResponse({
        title: document.title,
        url: window.location.href,
        messages: [],
        error:
          error instanceof Error ? error.message : "이미지를 읽지 못했습니다.",
      }),
    );
  return true;
});
