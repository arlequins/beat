"use client";

import { Check, Copy, Download, LoaderCircle, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { GourmetEntry } from "~/entities/gourmet";
import type { Locale } from "~/lib/i18n";

type ShareLabels = {
  copied: string;
  copyCaption: string;
  download: string;
  failed: string;
  fallback: string;
  share: string;
  shared: string;
  sharing: string;
};

const labels = {
  en: {
    copied: "Caption copied",
    copyCaption: "Copy caption",
    download: "Download JPEG",
    failed:
      "Could not prepare the Instagram post. Try downloading the image instead.",
    fallback: "The image was downloaded and the caption was copied.",
    share: "Share to Instagram",
    shared: "Shared. Finish the post in Instagram.",
    sharing: "Preparing the post…",
  },
  ja: {
    copied: "キャプションをコピーしました",
    copyCaption: "キャプションをコピー",
    download: "JPEGを保存",
    failed:
      "Instagram用の投稿を準備できませんでした。画像を保存してお試しください。",
    fallback: "画像を保存し、キャプションをコピーしました。",
    share: "Instagramで共有",
    shared: "共有しました。Instagramで投稿を仕上げてください。",
    sharing: "投稿を準備しています…",
  },
  ko: {
    copied: "캡션을 복사했습니다",
    copyCaption: "캡션 복사",
    download: "JPEG 저장",
    failed:
      "Instagram용 게시물을 준비하지 못했습니다. 이미지를 저장해 다시 시도해 주세요.",
    fallback: "이미지를 저장하고 캡션을 복사했습니다.",
    share: "Instagram으로 공유",
    shared: "공유했습니다. Instagram에서 게시를 마무리해 주세요.",
    sharing: "게시물을 준비하는 중…",
  },
} satisfies Record<Locale, ShareLabels>;

function captionFor(entry: GourmetEntry, locale: Locale) {
  const restaurant = [entry.restaurantName, entry.restaurantBranch]
    .filter(Boolean)
    .join(" · ");
  const mapQuery = encodeURIComponent(
    [entry.restaurantName, entry.restaurantBranch].filter(Boolean).join(" "),
  );
  const tags = [...entry.cuisineTags, ...entry.liked]
    .map((tag) =>
      tag
        .trim()
        .replace(/\s+/g, "")
        .replace(/[^\p{L}\p{N}_-]/gu, ""),
    )
    .filter(Boolean)
    .filter((tag, index, values) => values.indexOf(tag) === index)
    .slice(0, 2)
    .map((tag) => `#${tag}`);
  tags.push(locale === "ko" ? "#구루메 #Beat" : "#Gourmet #Beat");
  return [
    `${restaurant} · ${entry.menuName} · ${entry.rating.toFixed(1)}/10`,
    `https://www.google.com/maps/search/?api=1&query=${mapQuery}`,
    tags.join(" "),
  ].join("\n");
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function toJpegFile(imageUrl: string, fileName: string) {
  const response = await fetch(imageUrl, { credentials: "omit" });
  if (!response.ok) throw new Error("image-fetch-failed");
  const source = await response.blob();
  if (typeof createImageBitmap !== "function") {
    if (source.type === "image/jpeg")
      return new File([source], fileName, { type: "image/jpeg" });
    throw new Error("image-conversion-unavailable");
  }

  const bitmap = await createImageBitmap(source, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, 1_600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!jpeg) throw new Error("image-conversion-failed");
  return new File([jpeg], fileName, { type: "image/jpeg" });
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function GourmetShareButton(props: {
  entry: GourmetEntry;
  imageUrl: string;
  locale: Locale;
}) {
  const copy = labels[props.locale];
  const caption = useMemo(
    () => captionFor(props.entry, props.locale),
    [props.entry, props.locale],
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function copyCaption() {
    try {
      await copyText(caption);
      setStatus(copy.copied);
    } catch {
      setStatus(copy.failed);
    }
  }

  async function share() {
    setBusy(true);
    setStatus(copy.sharing);
    try {
      const safeName = props.entry.slug.replace(/[^a-z0-9-_]+/gi, "-");
      const file = await toJpegFile(
        props.imageUrl,
        `${safeName || "gourmet"}.jpg`,
      );
      const canShareFile =
        typeof navigator.share === "function" &&
        (!navigator.canShare || navigator.canShare({ files: [file] }));

      if (canShareFile) {
        await navigator.share({
          files: [file],
          text: caption,
          title: props.entry.restaurantName,
        });
        setStatus(copy.shared);
      } else {
        downloadFile(file);
        await copyText(caption);
        setStatus(copy.fallback);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("");
      } else {
        setStatus(copy.failed);
      }
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setStatus(copy.sharing);
    try {
      const safeName = props.entry.slug.replace(/[^a-z0-9-_]+/gi, "-");
      const file = await toJpegFile(
        props.imageUrl,
        `${safeName || "gourmet"}.jpg`,
      );
      downloadFile(file);
      setStatus(copy.download);
    } catch {
      setStatus(copy.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
      <button
        className="inline-flex items-center justify-center gap-2 bg-[var(--foreground)] px-4 py-3 text-sm font-bold text-[var(--background)] transition hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
        disabled={busy}
        onClick={() => void share()}
        type="button"
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Share2 className="size-4" />
        )}
        {busy ? copy.sharing : copy.share}
      </button>
      <button
        className="inline-flex items-center justify-center gap-2 border border-[var(--line)] px-4 py-3 text-sm font-bold transition hover:border-[var(--accent-foreground)] hover:text-[var(--accent-foreground)]"
        onClick={() => void copyCaption()}
        type="button"
      >
        {status === copy.copied ? (
          <Check className="size-4" />
        ) : (
          <Copy className="size-4" />
        )}
        {copy.copyCaption}
      </button>
      <button
        className="inline-flex items-center justify-center gap-2 border border-[var(--line)] px-4 py-3 text-sm font-bold transition hover:border-[var(--accent-foreground)] hover:text-[var(--accent-foreground)] disabled:cursor-wait disabled:opacity-60"
        disabled={busy}
        onClick={() => void download()}
        type="button"
      >
        <Download className="size-4" />
        {copy.download}
      </button>
      <span
        aria-live="polite"
        className="text-xs text-[var(--muted-foreground)]"
      >
        {status}
      </span>
    </div>
  );
}

export { captionFor };
