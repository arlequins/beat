"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  MapPin,
  Search,
  Star,
  Utensils,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  type GourmetEntry,
  type GourmetList,
  gourmetApiUrl,
  gourmetDate,
  publicGourmetImage,
} from "~/lib/gourmet";
import { type Locale, localePath } from "~/lib/i18n";

const text = {
  en: {
    allAreas: "All areas",
    adminLink: "Open the editor",
    emptyBody:
      "Save a meal from mobile Beat or add the first record in the admin editor.",
    emptyTitle: "The table is waiting for its first note.",
    back: "All records",
    discoveries: "Discoveries",
    empty: "No meals match these filters yet.",
    eyebrow: "A personal table, remembered",
    failed: "Unable to load Gourmet records.",
    intro:
      "Meals, discoveries, and the small details worth revisiting — recorded with Beat and finally reviewed by Arlequin.",
    liked: "What stood out",
    loading: "Setting the table…",
    photoPending: "Photo under review",
    revisit: "Revisit",
    revisitNo: "Not now",
    revisitUnknown: "Undecided",
    revisitYes: "Recommended",
    search: "Search restaurant",
    title: "Gourmet notes",
  },
  ja: {
    allAreas: "すべてのエリア",
    adminLink: "管理画面を開く",
    emptyBody:
      "モバイルBeatから食事を記録するか、管理画面で最初のノートを追加してください。",
    emptyTitle: "最初のノートを待っています。",
    back: "すべての記録",
    discoveries: "新しい発見",
    empty: "条件に合う食事の記録はまだありません。",
    eyebrow: "記憶しておきたい、自分だけの食卓",
    failed: "Gourmet記録を読み込めませんでした。",
    intro:
      "食事、発見、もう一度訪れたい理由。Beatと記録し、Arlequinが最終確認したノートです。",
    liked: "良かった点",
    loading: "テーブルを準備しています…",
    photoPending: "写真をレビュー中",
    revisit: "再訪",
    revisitNo: "保留",
    revisitUnknown: "未定",
    revisitYes: "おすすめ",
    search: "店名で検索",
    title: "Gourmetノート",
  },
  ko: {
    allAreas: "모든 지역",
    adminLink: "관리 화면 열기",
    emptyBody:
      "모바일 Beat에서 식사를 기록하거나 관리자 화면에서 첫 기록을 추가해 주세요.",
    emptyTitle: "첫 번째 기록을 기다리고 있습니다.",
    back: "전체 기록",
    discoveries: "새로운 발견",
    empty: "조건에 맞는 식사 기록이 아직 없습니다.",
    eyebrow: "기억해두고 싶은 개인의 식탁",
    failed: "기록을 불러오지 못했습니다.",
    intro:
      "먹은 것과 발견한 맛, 다시 찾고 싶은 이유를 Beat와 기록하고 Arlequin이 최종 확인합니다.",
    liked: "좋았던 점",
    loading: "식탁을 준비하고 있습니다…",
    photoPending: "사진 검토 중",
    revisit: "재방문",
    revisitNo: "보류",
    revisitUnknown: "미정",
    revisitYes: "추천",
    search: "식당 이름으로 검색",
    title: "Gourmet 기록",
  },
} satisfies Record<Locale, Record<string, string>>;

function Rating(props: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-[var(--accent-foreground)]">
      <Star aria-hidden="true" className="size-3.5 fill-current" />
      {props.value.toFixed(1)}
    </span>
  );
}

function GourmetPhoto(props: {
  image?: GourmetEntry["images"][number];
  pendingLabel: string;
  priority?: boolean;
  sizes: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface)]">
      {props.image && !failed ? (
        <Image
          alt={props.image.altText}
          className="object-cover transition duration-500 group-hover:scale-[1.025]"
          fill
          onError={() => setFailed(true)}
          priority={props.priority}
          sizes={props.sizes}
          src={publicGourmetImage(props.image)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-xs font-bold tracking-[0.15em] text-[var(--muted-foreground)] uppercase">
          {props.pendingLabel}
        </div>
      )}
    </div>
  );
}

export function GourmetBrowser(props: { locale: Locale }) {
  const labels = text[props.locale];
  const searchParams = useSearchParams();
  const selectedSlug = searchParams.get("entry");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [list, setList] = useState<GourmetList>();
  const [selected, setSelected] = useState<GourmetEntry>();
  const [message, setMessage] = useState(labels.loading);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ pageSize: "48" });
    if (query.trim()) params.set("restaurantName", query.trim());
    if (area.trim()) params.set("area", area.trim());
    fetch(`${gourmetApiUrl()}/api/gourmet/entries?${params}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(labels.failed);
        return (await response.json()) as GourmetList;
      })
      .then((value) => {
        setList(value);
        setMessage("");
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError")
          setMessage(error instanceof Error ? error.message : labels.failed);
      });
    return () => controller.abort();
  }, [area, labels.failed, query]);

  useEffect(() => {
    if (!selectedSlug) {
      setSelected(undefined);
      return;
    }
    const controller = new AbortController();
    fetch(
      `${gourmetApiUrl()}/api/gourmet/entries/${encodeURIComponent(selectedSlug)}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(labels.failed);
        return (await response.json()) as GourmetEntry;
      })
      .then(setSelected)
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError")
          setMessage(error instanceof Error ? error.message : labels.failed);
      });
    return () => controller.abort();
  }, [labels.failed, selectedSlug]);

  const areas = useMemo(
    () =>
      [
        ...new Set(
          list?.entries.map((entry) => entry.area).filter(Boolean) as string[],
        ),
      ].sort(),
    [list],
  );

  if (selectedSlug && selected)
    return (
      <article className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-20">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted-foreground)] hover:text-[var(--accent-foreground)]"
          href={localePath(props.locale, "/gourmet/")}
        >
          <ArrowLeft className="size-4" /> {labels.back}
        </Link>
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <GourmetPhoto
              image={selected.images[0]}
              pendingLabel={labels.photoPending}
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          </div>
          <div className="self-center">
            <p className="brand-eyebrow text-[var(--accent-foreground)]">
              {gourmetDate(selected)} · {selected.source}
            </p>
            <h1 className="display-serif mt-4 text-5xl tracking-[-0.05em]">
              {selected.restaurantName}
            </h1>
            <p className="mt-3 text-xl font-semibold">{selected.menuName}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-[var(--muted-foreground)]">
              <Rating value={selected.rating} />
              {selected.area ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {selected.area}
                </span>
              ) : null}
              <span>
                {labels.revisit}{" "}
                {selected.revisit === "yes"
                  ? labels.revisitYes
                  : selected.revisit === "no"
                    ? labels.revisitNo
                    : labels.revisitUnknown}
              </span>
            </div>
            <p className="mt-8 text-lg leading-8">{selected.summary}</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {[...selected.cuisineTags, ...selected.tasteNotes].map((tag) => (
                <span
                  className="border border-[var(--line)] px-3 py-1 text-xs"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
            {selected.liked.length ? (
              <p className="mt-8 text-sm leading-7">
                <strong>{labels.liked}</strong>
                <br />
                {selected.liked.join(" · ")}
              </p>
            ) : null}
            {selected.discoveries.length ? (
              <p className="mt-5 text-sm leading-7">
                <strong>{labels.discoveries}</strong>
                <br />
                {selected.discoveries.join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
      </article>
    );

  return (
    <div>
      <section className="brand-hero px-5 py-16 text-white sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="brand-eyebrow text-[#79e6e0]">{labels.eyebrow}</p>
          <h1 className="display-serif mt-5 max-w-4xl text-6xl tracking-[-0.055em] sm:text-7xl">
            {labels.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            {labels.intro}
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-20">
        <div className="grid gap-3 border-y border-[var(--line)] py-5 sm:grid-cols-[1fr_14rem]">
          <label className="flex items-center gap-3 border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <Search className="size-4 text-[var(--muted-foreground)]" />
            <input
              aria-label={labels.search}
              className="w-full bg-transparent outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.search}
              value={query}
            />
          </label>
          <select
            aria-label="지역"
            className="border border-[var(--line)] bg-[var(--surface)] px-4"
            onChange={(event) => setArea(event.target.value)}
            value={area}
          >
            <option value="">{labels.allAreas}</option>
            {areas.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        {message ? (
          <p className="py-16 text-center text-[var(--muted-foreground)]">
            {message}
          </p>
        ) : null}
        {!message && list?.entries.length === 0 ? (
          <div className="mx-auto my-12 max-w-xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center sm:p-12">
            <Utensils
              aria-hidden="true"
              className="mx-auto size-8 text-[var(--accent-foreground)]"
            />
            <h2 className="mt-5 font-serif text-3xl font-black tracking-[-0.03em]">
              {labels.emptyTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[var(--muted-foreground)]">
              {labels.emptyBody}
            </p>
            <Link
              className="mt-6 inline-flex border border-[var(--line)] px-4 py-2 text-sm font-bold hover:border-[var(--accent-foreground)] hover:text-[var(--accent-foreground)]"
              href={localePath(props.locale, "/admin/")}
            >
              {labels.adminLink}
            </Link>
          </div>
        ) : null}
        <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {list?.entries.map((entry) => (
            <article className="group" key={entry.id}>
              <Link href={`?entry=${encodeURIComponent(entry.slug)}`} scroll>
                <GourmetPhoto
                  image={entry.images[0]}
                  pendingLabel="Beat Gourmet"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
                <div className="mt-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                      {gourmetDate(entry)}
                      {entry.area ? ` · ${entry.area}` : ""}
                    </p>
                    <h2 className="display-serif mt-2 text-2xl tracking-[-0.035em]">
                      {entry.restaurantName}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {entry.menuName}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-1 size-4 shrink-0 text-[var(--accent-foreground)]" />
                </div>
                <div className="mt-3">
                  <Rating value={entry.rating} />
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
