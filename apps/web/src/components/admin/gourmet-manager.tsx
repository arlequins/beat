"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  History,
  ImagePlus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
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

type QualityReport = {
  errorCount: number;
  issues: Array<{
    code: string;
    entryId: string;
    message: string;
    severity: "error" | "warning";
  }>;
  warningCount: number;
};

type HistoryItem = {
  menuName: string;
  restaurantName: string;
  revision: number;
  status: "draft" | "published" | "deleted";
  updatedAt: string;
  visitedAt: string | null;
};

type ImageHistoryItem = {
  image: GourmetImage & { originalFilename?: string };
  revision: number;
};

type PendingUpload = {
  file: File;
  previewUrl: string;
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
    visitedAt: /^\d{4}-\d{2}-\d{2}$/.test(form.visitedAt)
      ? form.visitedAt
      : null,
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
  const [entryQuery, setEntryQuery] = useState("");
  const [entryStatus, setEntryStatus] = useState<
    "all" | "draft" | "published" | "deleted"
  >("all");
  const [entryMedia, setEntryMedia] = useState<
    "all" | "with-image" | "missing-image"
  >("all");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [quality, setQuality] = useState<QualityReport>();
  const [imageDrafts, setImageDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = useMemo(
    () => entries.find((entry) => entry.id === selectedId),
    [entries, selectedId],
  );
  const visibleEntries = useMemo(() => {
    const normalizedQuery = entryQuery.trim().toLocaleLowerCase();
    return entries
      .filter((entry) => entryStatus === "all" || entry.status === entryStatus)
      .filter((entry) => {
        if (entryMedia === "with-image") return entry.images.length > 0;
        if (entryMedia === "missing-image") return entry.images.length === 0;
        return true;
      })
      .filter((entry) => {
        if (!normalizedQuery) return true;
        return [
          entry.restaurantName,
          entry.restaurantBranch,
          entry.menuName,
          entry.area,
        ]
          .filter(Boolean)
          .some((value) =>
            value?.toLocaleLowerCase().includes(normalizedQuery),
          );
      })
      .sort((left, right) => {
        const leftDate = left.visitedAt ?? left.createdAt;
        const rightDate = right.visitedAt ?? right.createdAt;
        return rightDate.localeCompare(leftDate);
      });
  }, [entries, entryMedia, entryQuery, entryStatus]);
  const [adminImageUrls, setAdminImageUrls] = useState<Record<string, string>>(
    {},
  );
  const [imagePreviewErrors, setImagePreviewErrors] = useState<
    Record<string, string>
  >({});
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload>();
  const archived = selected?.status === "deleted";

  useEffect(
    () => () => {
      if (pendingUpload) URL.revokeObjectURL(pendingUpload.previewUrl);
    },
    [pendingUpload],
  );

  useEffect(() => {
    let disposed = false;
    const objectUrls: string[] = [];
    setAdminImageUrls({});
    setImagePreviewErrors({});
    if (!selected || selected.status === "published") return () => undefined;

    void Promise.all(
      selected.images.map(async (image) => {
        try {
          const response = await authorizedBeatAdminRequest(
            `/admin/gourmet/entries/${selected.id}/images/${image.id}${previewAttempt > 0 ? `?preview=${previewAttempt}` : ""}`,
          );
          if (!response.ok) {
            if (!disposed)
              setImagePreviewErrors((current) => ({
                ...current,
                [image.id]: "미리보기를 불러오지 못했습니다.",
              }));
            return;
          }
          const objectUrl = URL.createObjectURL(await response.blob());
          objectUrls.push(objectUrl);
          if (!disposed)
            setAdminImageUrls((current) => ({
              ...current,
              [image.id]: objectUrl,
            }));
        } catch {
          if (!disposed)
            setImagePreviewErrors((current) => ({
              ...current,
              [image.id]: "미리보기를 불러오지 못했습니다.",
            }));
        }
      }),
    );
    return () => {
      disposed = true;
      for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl);
    };
  }, [previewAttempt, selected]);

  useEffect(() => {
    setImageDrafts(
      Object.fromEntries(
        (selected?.images ?? []).map((image) => [image.id, image.altText]),
      ),
    );
    if (!selected) {
      setHistory([]);
      setImageHistory([]);
      return;
    }
    let disposed = false;
    void authorizedBeatAdminRequest(
      `/api/gourmet/entries/${selected.id}/history`,
    )
      .then(async (response) => {
        if (!response.ok) return;
        const value = (await response.json()) as HistoryItem[];
        if (!disposed) setHistory(value);
      })
      .catch(() => undefined);
    void authorizedBeatAdminRequest(
      `/admin/gourmet/entries/${selected.id}/image-history`,
    )
      .then(async (response) => {
        if (!response.ok) return;
        const value = (await response.json()) as ImageHistoryItem[];
        if (!disposed) setImageHistory(value);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
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
      setEntries(result.entries);
      const qualityResponse = await authorizedBeatAdminRequest(
        "/api/gourmet/quality",
      );
      if (qualityResponse.ok)
        setQuality((await qualityResponse.json()) as QualityReport);
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
    setPendingUpload(undefined);
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
    if (archived) return;
    setBusy(true);
    setMessage("");
    try {
      if (form.visitedAt && !/^\d{4}-\d{2}-\d{2}$/.test(form.visitedAt))
        throw new Error("방문일은 YYYY-MM-DD 형식으로 입력해 주세요.");
      if (form.status === "published" && !form.visitedAt)
        throw new Error("공개하려면 정확한 방문일을 먼저 입력해 주세요.");
      const requestPayload = payload(form);
      const response = await authorizedBeatAdminRequest(
        selected
          ? `/api/gourmet/entries/${selected.id}`
          : "/api/gourmet/entries",
        {
          body: JSON.stringify(
            selected
              ? { ...requestPayload, expectedRevision: selected.revision }
              : requestPayload,
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
      if (saved.visitedAt !== requestPayload.visitedAt)
        throw new Error(
          "방문일 저장 결과가 일치하지 않습니다. 새로고침 후 다시 시도해 주세요.",
        );
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

  async function restore() {
    if (!selected || !archived) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await authorizedBeatAdminRequest(
        `/api/gourmet/entries/${selected.id}/restore`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error("기록을 복구하지 못했습니다.");
      const restored = (await response.json()) as GourmetEntry;
      await loadEntries();
      setSelectedId(restored.id);
      setForm(formFor(restored));
      setMessage(`기록을 초안으로 복구했습니다. 리비전 ${restored.revision}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "복구 실패");
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

  function queueUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selected) return;
    if (!file.type.startsWith("image/")) {
      setMessage("이미지 파일만 선택할 수 있습니다.");
      return;
    }
    setPendingUpload((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
    setMessage("사진을 확인한 뒤 업로드를 확정해 주세요.");
  }

  function cancelUpload() {
    setPendingUpload(undefined);
    setMessage("사진 업로드를 취소했습니다.");
  }

  async function confirmUpload() {
    if (!pendingUpload || !selected) return;
    const { file } = pendingUpload;
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
      setPendingUpload(undefined);
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

  async function restoreImage(item: ImageHistoryItem) {
    if (!selected || archived) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await authorizedBeatAdminRequest(
        `/admin/gourmet/entries/${selected.id}/images/${item.image.id}/restore`,
        { method: "POST" },
      );
      if (response.status === 409)
        throw new Error(
          "다른 변경이 먼저 저장되었습니다. 목록을 새로고침해 주세요.",
        );
      if (!response.ok) throw new Error("분리된 사진을 복원하지 못했습니다.");
      const updated = (await response.json()) as GourmetEntry;
      setEntries((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setForm(formFor(updated));
      setMessage("분리된 사진을 복원했습니다. S3 원본은 그대로 유지됩니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "사진 복원 실패");
    } finally {
      setBusy(false);
    }
  }

  async function updateImage(
    image: GourmetImage,
    changes: { altText?: string; sortOrder?: number },
  ) {
    if (!selected || archived) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await authorizedBeatAdminRequest(
        `/admin/gourmet/entries/${selected.id}/images/${image.id}`,
        {
          body: JSON.stringify({
            ...changes,
            expectedRevision: selected.revision,
          }),
          method: "PATCH",
        },
      );
      if (response.status === 409)
        throw new Error(
          "다른 변경이 먼저 저장되었습니다. 목록을 새로고침해 주세요.",
        );
      if (!response.ok) throw new Error("사진 정보를 저장하지 못했습니다.");
      const updated = (await response.json()) as GourmetEntry;
      setEntries((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setForm(formFor(updated));
      setMessage("사진 설명과 순서를 저장했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "사진 정보 저장 실패",
      );
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const orderedImages = useMemo(
    () =>
      [...(selected?.images ?? [])].sort(
        (left, right) => left.sortOrder - right.sortOrder,
      ),
    [selected?.images],
  );
  const currentEntry = selected;

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
      {quality && (quality.errorCount > 0 || quality.warningCount > 0) ? (
        <div className="grid gap-3 border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4" />
            데이터 확인 필요 · 오류 {quality.errorCount} · 경고{" "}
            {quality.warningCount}
          </div>
          <ul className="grid gap-1 text-xs text-[var(--muted-foreground)]">
            {quality.issues.slice(0, 5).map((issue) => (
              <li key={`${issue.entryId}-${issue.code}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <aside className="max-h-[44rem] overflow-auto border border-[var(--line)] bg-[var(--surface)]">
          <div className="sticky top-0 z-10 grid gap-2 border-b border-[var(--line)] bg-[var(--surface)] p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <span className="sr-only">Gourmet 기록 검색</span>
              <input
                className="w-full border border-[var(--line)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--accent-foreground)]"
                onChange={(event) => setEntryQuery(event.target.value)}
                placeholder="식당·메뉴·지역 검색"
                type="search"
                value={entryQuery}
              />
            </label>
            <select
              aria-label="Gourmet 공개 상태 필터"
              className="border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-xs font-bold"
              onChange={(event) =>
                setEntryStatus(
                  event.target.value as
                    | "all"
                    | "draft"
                    | "published"
                    | "deleted",
                )
              }
              value={entryStatus}
            >
              <option value="all">전체 상태 ({entries.length})</option>
              <option value="draft">
                초안 (
                {entries.filter((entry) => entry.status === "draft").length})
              </option>
              <option value="published">
                공개 (
                {entries.filter((entry) => entry.status === "published").length}
                )
              </option>
              <option value="deleted">
                보관 (
                {entries.filter((entry) => entry.status === "deleted").length})
              </option>
            </select>
            <select
              aria-label="Gourmet 사진 상태 필터"
              className="border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-xs font-bold"
              onChange={(event) =>
                setEntryMedia(
                  event.target.value as "all" | "with-image" | "missing-image",
                )
              }
              value={entryMedia}
            >
              <option value="all">사진 전체</option>
              <option value="with-image">사진 있음</option>
              <option value="missing-image">사진 없음</option>
            </select>
          </div>
          {visibleEntries.map((entry) => (
            <button
              className={`block w-full border-b border-[var(--line)] p-4 text-left ${entry.id === selectedId ? "bg-[var(--background)]" : ""}`}
              key={entry.id}
              onClick={() => select(entry)}
              type="button"
            >
              <span className="block font-bold">{entry.restaurantName}</span>
              <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                {entry.visitedAt ?? "날짜 미상"} · {entry.menuName} ·{" "}
                {entry.rating.toFixed(1)} ·{" "}
                {entry.status === "published"
                  ? "공개"
                  : entry.status === "deleted"
                    ? "보관"
                    : "초안"}
                {entry.images.length === 0 ? " · 사진 없음" : ""}
              </span>
            </button>
          ))}
          {!visibleEntries.length ? (
            <p className="p-5 text-sm leading-6 text-[var(--muted-foreground)]">
              {entries.length
                ? "현재 검색·필터 조건에 맞는 기록이 없습니다."
                : "아직 기록이 없습니다. 오른쪽의 새 기록으로 직접 추가하거나 모바일 Beat에서 식사 내용을 보내 주세요."}
            </p>
          ) : null}
        </aside>
        <div className="grid gap-4 border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              disabled={archived}
              label="식당"
              value={form.restaurantName}
              onChange={(value) => set("restaurantName", value)}
            />
            <Field
              disabled={archived}
              label="지점"
              value={form.restaurantBranch}
              onChange={(value) => set("restaurantBranch", value)}
            />
            <Field
              disabled={archived}
              label="메뉴"
              value={form.menuName}
              onChange={(value) => set("menuName", value)}
            />
            <Field
              disabled={archived}
              label="지역"
              value={form.area}
              onChange={(value) => set("area", value)}
            />
            <Field
              disabled={archived}
              label="방문일"
              type="date"
              value={form.visitedAt}
              onChange={(value) => set("visitedAt", value)}
            />
            <Field
              disabled={archived}
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
              disabled={archived}
              value={form.summary}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {commaFields.map((field) => (
              <Field
                disabled={archived}
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
              disabled={archived}
              value={form.freeTextNote}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              재방문
              <select
                className="border border-[var(--line)] bg-[var(--background)] p-3"
                disabled={archived}
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
                disabled={archived}
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
                busy ||
                archived ||
                !form.restaurantName ||
                !form.menuName ||
                !form.summary
              }
              onClick={() => void save()}
              type="button"
            >
              <Save className="size-4" />
              저장
            </button>
            {selected && archived ? (
              <button
                className="flex items-center gap-2 border border-[var(--accent-foreground)] px-5 py-3 font-bold text-[var(--accent-foreground)]"
                disabled={busy}
                onClick={() => void restore()}
                type="button"
              >
                <RotateCcw className="size-4" />
                초안으로 복구
              </button>
            ) : selected ? (
              <>
                <label className="flex cursor-pointer items-center gap-2 border border-[var(--line)] px-5 py-3 font-bold">
                  <ImagePlus className="size-4" />
                  사진 선택
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={busy}
                    onChange={queueUpload}
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
          {pendingUpload && selected ? (
            <div className="grid gap-4 border border-[var(--accent-foreground)] bg-[var(--surface)] p-4 sm:grid-cols-[12rem_1fr]">
              <div className="relative aspect-[4/3] overflow-hidden bg-[var(--background)]">
                <Image
                  alt={`${selected.restaurantName} ${selected.menuName} 업로드 미리보기`}
                  className="object-contain"
                  fill
                  priority
                  sizes="192px"
                  src={pendingUpload.previewUrl}
                  unoptimized
                />
              </div>
              <div className="grid content-center gap-3">
                <div>
                  <p className="text-sm font-bold">업로드 전 사진 확인</p>
                  <p className="mt-1 break-all text-xs text-[var(--muted-foreground)]">
                    {pendingUpload.file.name} ·{" "}
                    {pendingUpload.file.type || "image"} ·{" "}
                    {pendingUpload.file.size.toLocaleString()} bytes
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                    확인하면 위치 정보가 제거되고 WebP로 최적화된 사본만 private
                    S3에 저장됩니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="border border-[var(--line)] px-4 py-2 text-sm font-bold"
                    disabled={busy}
                    onClick={cancelUpload}
                    type="button"
                  >
                    취소
                  </button>
                  <button
                    className="bg-[var(--foreground)] px-4 py-2 text-sm font-bold text-[var(--background)] disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void confirmUpload()}
                    type="button"
                  >
                    {busy ? "처리 중…" : "확인하고 S3에 저장"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {currentEntry
            ? orderedImages.map((image, imageIndex) => (
                <div
                  className="grid gap-3 border border-[var(--line)] bg-[var(--background)] p-3 sm:grid-cols-[8rem_1fr_auto] sm:items-start"
                  key={image.id}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface)]">
                    {imagePreviewErrors[image.id] ? (
                      <div className="absolute inset-0 grid place-items-center gap-2 p-3 text-center text-xs font-bold text-red-600">
                        <span>{imagePreviewErrors[image.id]}</span>
                        <button
                          className="border border-red-500/50 px-2 py-1 text-[0.7rem] underline underline-offset-2"
                          onClick={() => {
                            setImagePreviewErrors((current) => {
                              const next = { ...current };
                              delete next[image.id];
                              return next;
                            });
                            setPreviewAttempt((current) => current + 1);
                          }}
                          type="button"
                        >
                          다시 시도
                        </button>
                      </div>
                    ) : (
                        currentEntry.status === "published"
                          ? publicGourmetImage(image)
                          : adminImageUrls[image.id]
                      ) ? (
                      <Image
                        alt={image.altText}
                        className="object-cover"
                        fill
                        loading="lazy"
                        onError={() =>
                          setImagePreviewErrors((current) => ({
                            ...current,
                            [image.id]: "미리보기를 불러오지 못했습니다.",
                          }))
                        }
                        sizes="128px"
                        src={
                          currentEntry.status === "published" &&
                          previewAttempt > 0
                            ? `${publicGourmetImage(image)}${publicGourmetImage(image).includes("?") ? "&" : "?"}preview=${previewAttempt}`
                            : currentEntry.status === "published"
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
                  <div className="grid gap-2 text-sm">
                    <label className="grid gap-1 text-xs font-bold">
                      사진 설명
                      <input
                        className="border border-[var(--line)] bg-[var(--surface)] p-2 font-normal"
                        disabled={busy || archived}
                        onChange={(event) =>
                          setImageDrafts((current) => ({
                            ...current,
                            [image.id]: event.target.value,
                          }))
                        }
                        value={imageDrafts[image.id] ?? image.altText}
                      />
                    </label>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {image.mimeType ?? "image/webp"} ·{" "}
                      {image.byteSize.toLocaleString()} bytes
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        aria-label={`${image.altText} 사진 위로 이동`}
                        className="inline-flex items-center gap-1 border border-[var(--line)] px-2 py-1 text-xs font-bold disabled:opacity-50"
                        disabled={busy || archived || imageIndex === 0}
                        onClick={() =>
                          void updateImage(image, { sortOrder: imageIndex - 1 })
                        }
                        type="button"
                      >
                        <ArrowUp className="size-3.5" />
                        위로
                      </button>
                      <button
                        aria-label={`${image.altText} 사진 아래로 이동`}
                        className="inline-flex items-center gap-1 border border-[var(--line)] px-2 py-1 text-xs font-bold disabled:opacity-50"
                        disabled={
                          busy ||
                          archived ||
                          imageIndex === orderedImages.length - 1
                        }
                        onClick={() =>
                          void updateImage(image, { sortOrder: imageIndex + 1 })
                        }
                        type="button"
                      >
                        <ArrowDown className="size-3.5" />
                        아래로
                      </button>
                      <button
                        className="inline-flex items-center gap-1 border border-[var(--accent-foreground)] px-2 py-1 text-xs font-bold text-[var(--accent-foreground)] disabled:opacity-50"
                        disabled={busy || archived}
                        onClick={() =>
                          void updateImage(image, {
                            altText: imageDrafts[image.id] ?? image.altText,
                          })
                        }
                        type="button"
                      >
                        <Check className="size-3.5" />
                        설명 저장
                      </button>
                    </div>
                    {image.prUrl ? (
                      <a
                        className="inline-flex items-center gap-2 text-xs font-bold text-[var(--accent-foreground)] underline"
                        href={image.prUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <Utensils className="size-3.5" />
                        기존 GitHub 검토 링크{" "}
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        private S3 이미지
                      </span>
                    )}
                    {(
                      currentEntry.status === "published"
                        ? publicGourmetImage(image)
                        : adminImageUrls[image.id]
                    ) ? (
                      <GourmetShareButton
                        entry={currentEntry}
                        imageUrl={
                          currentEntry.status === "published"
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
                    disabled={busy || archived}
                    onClick={() => void removeImage(image)}
                    type="button"
                  >
                    <Trash2 className="size-3.5" />
                    사진 분리
                  </button>
                </div>
              ))
            : null}
          {selected && imageHistory.length ? (
            <section className="grid gap-3 border-t border-[var(--line)] pt-4">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <History className="size-4" />
                분리된 사진
              </h3>
              <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                S3 원본은 삭제하지 않고 기록에서만 분리했습니다. 필요한 사진은
                다시 연결할 수 있습니다.
              </p>
              <ul className="grid gap-2">
                {imageHistory.map((item) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 border border-[var(--line)] p-3 text-xs"
                    key={`${item.image.id}-${item.revision}`}
                  >
                    <span>
                      <strong className="block text-sm">
                        {item.image.altText}
                      </strong>
                      <span className="text-[var(--muted-foreground)]">
                        리비전 {item.revision} ·{" "}
                        {item.image.originalFilename ?? "S3 이미지"}
                      </span>
                    </span>
                    <button
                      className="border border-[var(--accent-foreground)] px-3 py-2 font-bold text-[var(--accent-foreground)] disabled:opacity-50"
                      disabled={busy || archived}
                      onClick={() => void restoreImage(item)}
                      type="button"
                    >
                      사진 복원
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {selected && history.length ? (
            <section className="grid gap-3 border-t border-[var(--line)] pt-4">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <History className="size-4" />
                변경 이력
              </h3>
              <ol className="grid gap-2 text-xs text-[var(--muted-foreground)]">
                {history.map((item) => (
                  <li
                    className="flex flex-wrap items-center gap-x-2 gap-y-1"
                    key={`${item.revision}-${item.updatedAt}`}
                  >
                    <span className="font-bold text-[var(--foreground)]">
                      리비전 {item.revision}
                    </span>
                    <span>
                      {item.status === "published"
                        ? "공개"
                        : item.status === "deleted"
                          ? "보관"
                          : "초안"}
                    </span>
                    <time dateTime={item.updatedAt}>
                      {item.updatedAt.slice(0, 16).replace("T", " ")}
                    </time>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
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
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {props.label}
      <input
        className="border border-[var(--line)] bg-[var(--background)] p-3 font-normal"
        disabled={props.disabled}
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
