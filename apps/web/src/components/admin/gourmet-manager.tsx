"use client";

import {
  ExternalLink,
  ImagePlus,
  RefreshCw,
  Save,
  Trash2,
  Utensils,
} from "lucide-react";
import Image from "next/image";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type GourmetEntry,
  type GourmetImage,
  type GourmetList,
  publicGourmetImage,
} from "~/entities/gourmet";
import { GourmetShareButton } from "~/features/gourmet-share/ui/gourmet-share-button";
import { authorizedBeatAdminRequest } from "~/lib/beat-admin-session";

type FormState = {
  area: string;
  cookingMethods: string;
  cuisineTags: string;
  discoveries: string;
  freeTextNote: string;
  ingredients: string;
  liked: string;
  menuName: string;
  nutritionTags: string;
  postMealNotes: string;
  rating: string;
  restaurantBranch: string;
  restaurantName: string;
  revisit: GourmetEntry["revisit"];
  status: "draft" | "published";
  summary: string;
  tasteNotes: string;
  visitedAt: string;
};

const emptyForm: FormState = {
  area: "",
  cookingMethods: "",
  cuisineTags: "",
  discoveries: "",
  freeTextNote: "",
  ingredients: "",
  liked: "",
  menuName: "",
  nutritionTags: "",
  postMealNotes: "",
  rating: "7",
  restaurantBranch: "",
  restaurantName: "",
  revisit: "unknown",
  status: "draft",
  summary: "",
  tasteNotes: "",
  visitedAt: new Date().toISOString().slice(0, 10),
};

const commaFields = [
  "cookingMethods",
  "cuisineTags",
  "discoveries",
  "ingredients",
  "liked",
  "nutritionTags",
  "postMealNotes",
  "tasteNotes",
] as const;

function textList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formFor(entry: GourmetEntry): FormState {
  return {
    area: entry.area ?? "",
    cookingMethods: entry.cookingMethods.join(", "),
    cuisineTags: entry.cuisineTags.join(", "),
    discoveries: entry.discoveries.join(", "),
    freeTextNote: entry.freeTextNote ?? "",
    ingredients: entry.ingredients.join(", "),
    liked: entry.liked.join(", "),
    menuName: entry.menuName,
    nutritionTags: entry.nutritionTags.join(", "),
    postMealNotes: entry.postMealNotes.join(", "),
    rating: String(entry.rating),
    restaurantBranch: entry.restaurantBranch ?? "",
    restaurantName: entry.restaurantName,
    revisit: entry.revisit,
    status: entry.status === "published" ? "published" : "draft",
    summary: entry.summary,
    tasteNotes: entry.tasteNotes.join(", "),
    visitedAt: entry.visitedAt ?? "",
  };
}

function payload(form: FormState) {
  const value: Record<string, unknown> = {
    area: form.area.trim() || null,
    externalRequestId: null,
    freeTextNote: form.freeTextNote.trim() || null,
    menuName: form.menuName.trim(),
    rating: Number(form.rating),
    restaurantBranch: form.restaurantBranch.trim() || null,
    restaurantName: form.restaurantName.trim(),
    revisit: form.revisit,
    source: "manual",
    status: form.status,
    summary: form.summary.trim(),
    visitedAt: form.visitedAt || null,
  };
  for (const field of commaFields) value[field] = textList(form[field]);
  return value;
}

async function optimizeImage(file: File) {
  if (!file.type.startsWith("image/"))
    throw new Error("이미지 파일만 선택할 수 있습니다.");
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  let scale = Math.min(1, 1_600 / Math.max(bitmap.width, bitmap.height));
  let quality = 0.84;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (blob && blob.size <= 700 * 1024) break;
    quality = Math.max(0.58, quality - 0.08);
    scale *= 0.84;
  }
  bitmap.close();
  if (!blob || blob.size > 700 * 1024)
    throw new Error("사진을 안전한 업로드 크기로 최적화하지 못했습니다.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  return { contentBase64: btoa(binary), contentType: "image/webp" as const };
}

export function GourmetManager() {
  const [entries, setEntries] = useState<GourmetEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = useMemo(
    () => entries.find((entry) => entry.id === selectedId),
    [entries, selectedId],
  );
  const [adminImageUrls, setAdminImageUrls] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    let disposed = false;
    const objectUrls: string[] = [];
    setAdminImageUrls({});
    if (!selected || selected.status === "published") return () => undefined;

    void Promise.all(
      selected.images.map(async (image) => {
        try {
          const response = await authorizedBeatAdminRequest(
            `/admin/gourmet/entries/${selected.id}/images/${image.id}`,
          );
          if (!response.ok) return;
          const objectUrl = URL.createObjectURL(await response.blob());
          objectUrls.push(objectUrl);
          if (!disposed)
            setAdminImageUrls((current) => ({
              ...current,
              [image.id]: objectUrl,
            }));
        } catch {
          // Keep the file metadata visible when a preview cannot be fetched.
        }
      }),
    );
    return () => {
      disposed = true;
      for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl);
    };
  }, [selected]);

  const loadEntries = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await authorizedBeatAdminRequest(
        "/api/gourmet/entries?pageSize=100",
      );
      if (!response.ok) throw new Error("Gourmet 기록을 불러오지 못했습니다.");
      const result = (await response.json()) as GourmetList;
      setEntries(result.entries.filter((entry) => entry.status !== "deleted"));
      setMessage(`${result.total}개의 기록을 불러왔습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "기록 조회 실패");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  function select(entry?: GourmetEntry) {
    setSelectedId(entry?.id);
    setForm(
      entry
        ? formFor(entry)
        : { ...emptyForm, visitedAt: new Date().toISOString().slice(0, 10) },
    );
    setMessage(
      entry
        ? `리비전 ${entry.revision}을 편집합니다.`
        : "새 기록을 작성합니다.",
    );
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await authorizedBeatAdminRequest(
        selected
          ? `/api/gourmet/entries/${selected.id}`
          : "/api/gourmet/entries",
        {
          body: JSON.stringify(
            selected
              ? { ...payload(form), expectedRevision: selected.revision }
              : payload(form),
          ),
          headers: selected
            ? undefined
            : { "Idempotency-Key": crypto.randomUUID() },
          method: selected ? "PATCH" : "POST",
        },
      );
      if (response.status === 409)
        throw new Error(
          "다른 변경이 먼저 저장되었습니다. 목록을 새로고침해 주세요.",
        );
      if (!response.ok) throw new Error("Gourmet 기록을 저장하지 못했습니다.");
      const result = (await response.json()) as
        | GourmetEntry
        | { entry: GourmetEntry };
      const saved = "entry" in result ? result.entry : result;
      await loadEntries();
      setSelectedId(saved.id);
      setForm(formFor(saved));
      setMessage(`리비전 ${saved.revision}을 저장했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !selected ||
      !window.confirm(`${selected.restaurantName} 기록을 보관 처리할까요?`)
    )
      return;
    setBusy(true);
    try {
      const response = await authorizedBeatAdminRequest(
        `/api/gourmet/entries/${selected.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("기록을 보관 처리하지 못했습니다.");
      select();
      await loadEntries();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제 실패");
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selected) return;
    setBusy(true);
    setMessage("사진을 축소하고 위치 정보를 제거하는 중입니다…");
    try {
      const optimized = await optimizeImage(file);
      const response = await authorizedBeatAdminRequest(
        `/admin/gourmet/entries/${selected.id}/images`,
        {
          body: JSON.stringify({
            altText: `${selected.restaurantName} ${selected.menuName}`,
            ...optimized,
            originalFilename: `${file.name.replace(/\.[^.]+$/, "") || "meal"}.webp`,
          }),
          method: "POST",
        },
      );
      if (!response.ok) throw new Error("사진을 S3에 저장하지 못했습니다.");
      const updated = (await response.json()) as GourmetEntry;
      setEntries((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setForm(formFor(updated));
      setMessage(
        "사진을 S3에 저장했습니다. 공개 기록의 이미지는 API를 통해 전달됩니다.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "사진 처리 실패");
    } finally {
      setBusy(false);
    }
  }

  async function removeImage(image: GourmetImage) {
    if (!selected || !window.confirm("이 사진을 기록에서 분리할까요?")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await authorizedBeatAdminRequest(
        `/admin/gourmet/entries/${selected.id}/images/${image.id}`,
        { method: "DELETE" },
      );
      if (response.status === 409)
        throw new Error(
          "다른 변경이 먼저 저장되었습니다. 목록을 새로고침해 주세요.",
        );
      if (!response.ok) throw new Error("사진을 기록에서 분리하지 못했습니다.");
      const updated = (await response.json()) as GourmetEntry;
      setEntries((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setForm(formFor(updated));
      setMessage(
        "사진을 기록에서 분리했습니다. 원본 S3 객체는 복구를 위해 보존됩니다.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "사진 처리 실패");
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <section
      className="mt-16 grid scroll-mt-8 gap-6 border-t border-[var(--line)] pt-12"
      id="gourmet-workspace"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-[var(--accent-foreground)] uppercase">
            Gourmet workspace
          </p>
          <h2 className="mt-2 font-serif text-4xl font-black">
            식사 기록 관리
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            기록과 최적화된 사진은 모두 private S3에 저장합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="border border-[var(--line)] p-3"
            disabled={busy}
            onClick={() => void loadEntries()}
            title="새로고침"
            type="button"
          >
            <RefreshCw className="size-4" />
          </button>
          <button
            className="border border-[var(--line)] px-4 py-2 font-bold"
            onClick={() => select()}
            type="button"
          >
            새 기록
          </button>
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <aside className="max-h-[44rem] overflow-auto border border-[var(--line)] bg-[var(--surface)]">
          {entries.map((entry) => (
            <button
              className={`block w-full border-b border-[var(--line)] p-4 text-left ${entry.id === selectedId ? "bg-[var(--background)]" : ""}`}
              key={entry.id}
              onClick={() => select(entry)}
              type="button"
            >
              <span className="block font-bold">{entry.restaurantName}</span>
              <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                {entry.menuName} · {entry.rating.toFixed(1)} · {entry.status}
              </span>
            </button>
          ))}
          {!entries.length ? (
            <p className="p-5 text-sm leading-6 text-[var(--muted-foreground)]">
              아직 기록이 없습니다. 오른쪽의 <strong>새 기록</strong>으로 직접
              추가하거나 모바일 Beat에서 식사 내용을 보내 주세요.
            </p>
          ) : null}
        </aside>
        <div className="grid gap-4 border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="식당"
              value={form.restaurantName}
              onChange={(value) => set("restaurantName", value)}
            />
            <Field
              label="지점"
              value={form.restaurantBranch}
              onChange={(value) => set("restaurantBranch", value)}
            />
            <Field
              label="메뉴"
              value={form.menuName}
              onChange={(value) => set("menuName", value)}
            />
            <Field
              label="지역"
              value={form.area}
              onChange={(value) => set("area", value)}
            />
            <Field
              label="방문일"
              type="date"
              value={form.visitedAt}
              onChange={(value) => set("visitedAt", value)}
            />
            <Field
              label="평점 (0–10, 0.5 단위)"
              max="10"
              min="0"
              step="0.5"
              type="number"
              value={form.rating}
              onChange={(value) => set("rating", value)}
            />
          </div>
          <label className="grid gap-2 text-sm font-bold">
            한 줄 요약
            <textarea
              className="min-h-24 border border-[var(--line)] bg-[var(--background)] p-3 font-normal"
              maxLength={500}
              onChange={(event) => set("summary", event.target.value)}
              value={form.summary}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {commaFields.map((field) => (
              <Field
                key={field}
                label={`${field} (쉼표 구분)`}
                value={form[field]}
                onChange={(value) => set(field, value)}
              />
            ))}
          </div>
          <label className="grid gap-2 text-sm font-bold">
            자유 메모
            <textarea
              className="min-h-28 border border-[var(--line)] bg-[var(--background)] p-3 font-normal"
              onChange={(event) => set("freeTextNote", event.target.value)}
              value={form.freeTextNote}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              재방문
              <select
                className="border border-[var(--line)] bg-[var(--background)] p-3"
                onChange={(event) =>
                  set("revisit", event.target.value as FormState["revisit"])
                }
                value={form.revisit}
              >
                <option value="yes">추천</option>
                <option value="no">보류</option>
                <option value="unknown">미정</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              공개 상태
              <select
                className="border border-[var(--line)] bg-[var(--background)] p-3"
                onChange={(event) =>
                  set("status", event.target.value as FormState["status"])
                }
                value={form.status}
              >
                <option value="draft">초안</option>
                <option value="published">공개</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <button
              className="flex items-center gap-2 bg-[var(--foreground)] px-5 py-3 font-bold text-[var(--background)] disabled:opacity-50"
              disabled={
                busy || !form.restaurantName || !form.menuName || !form.summary
              }
              onClick={() => void save()}
              type="button"
            >
              <Save className="size-4" />
              저장
            </button>
            {selected ? (
              <>
                <label className="flex cursor-pointer items-center gap-2 border border-[var(--line)] px-5 py-3 font-bold">
                  <ImagePlus className="size-4" />
                  S3에 사진 저장
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={busy}
                    onChange={(event) => void upload(event)}
                    type="file"
                  />
                </label>
                <button
                  className="flex items-center gap-2 border border-red-500/40 px-4 py-3 text-sm font-bold text-red-600"
                  disabled={busy}
                  onClick={() => void remove()}
                  type="button"
                >
                  <Trash2 className="size-4" />
                  보관
                </button>
              </>
            ) : null}
          </div>
          {selected?.images.map((image) => (
            <div
              className="grid gap-3 border border-[var(--line)] bg-[var(--background)] p-3 sm:grid-cols-[8rem_1fr_auto] sm:items-center"
              key={image.id}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface)]">
                {(
                  selected.status === "published"
                    ? publicGourmetImage(image)
                    : adminImageUrls[image.id]
                ) ? (
                  <Image
                    alt={image.altText}
                    className="object-cover"
                    fill
                    loading="lazy"
                    sizes="128px"
                    src={
                      selected.status === "published"
                        ? publicGourmetImage(image)
                        : adminImageUrls[image.id]!
                    }
                  />
                ) : (
                  <span className="absolute inset-0 grid place-items-center p-3 text-center text-xs font-bold text-[var(--muted-foreground)]">
                    미리보기를 불러오는 중
                  </span>
                )}
              </div>
              <div className="grid gap-1 text-sm">
                <p className="font-bold">{image.altText}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {image.mimeType ?? "image/webp"} ·{" "}
                  {image.byteSize.toLocaleString()} bytes
                </p>
                {image.prUrl ? (
                  <a
                    className="inline-flex items-center gap-2 text-xs font-bold text-[var(--accent-foreground)] underline"
                    href={image.prUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Utensils className="size-3.5" />
                    기존 GitHub 검토 링크 <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="text-xs text-[var(--muted-foreground)]">
                    private S3 이미지
                  </span>
                )}
                {(
                  selected.status === "published"
                    ? publicGourmetImage(image)
                    : adminImageUrls[image.id]
                ) ? (
                  <GourmetShareButton
                    entry={selected}
                    imageUrl={
                      selected.status === "published"
                        ? publicGourmetImage(image)
                        : adminImageUrls[image.id]!
                    }
                    locale="ko"
                  />
                ) : null}
              </div>
              <button
                aria-label={`${image.altText} 사진 분리`}
                className="inline-flex items-center justify-center gap-2 border border-red-500/40 px-3 py-2 text-xs font-bold text-red-600"
                disabled={busy}
                onClick={() => void removeImage(image)}
                type="button"
              >
                <Trash2 className="size-3.5" />
                사진 분리
              </button>
            </div>
          ))}
          {message ? (
            <p
              aria-live="polite"
              className="text-sm text-[var(--muted-foreground)]"
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Field(props: {
  label: string;
  max?: string;
  min?: string;
  onChange: (value: string) => void;
  step?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {props.label}
      <input
        className="border border-[var(--line)] bg-[var(--background)] p-3 font-normal"
        max={props.max}
        min={props.min}
        onChange={(event) => props.onChange(event.target.value)}
        step={props.step}
        type={props.type ?? "text"}
        value={props.value}
      />
    </label>
  );
}
