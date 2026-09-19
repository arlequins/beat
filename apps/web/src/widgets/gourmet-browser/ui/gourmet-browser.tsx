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
  gourmetTimeline,
  publicGourmetImage,
} from "~/entities/gourmet";
import { GourmetShareButton } from "~/features/gourmet-share/ui/gourmet-share-button";
import { type Locale, localePath } from "~/lib/i18n";

const text = {
  en: {
    allAreas: "All areas",
    allCuisines: "All cuisines",
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
    average: "Average rating",
    map: "Open in Google Maps",
    minimumRating: "Any rating",
    noPhoto: "No photo",
    photoPending: "Photo could not be loaded",
    retryPhoto: "Retry photo",
    photos: "Photos",
    records: "records",
    recommended: "Recommended to revisit",
    revisit: "Revisit",
    revisitFilter: "Any revisit plan",
    revisitNo: "Not now",
    revisitUnknown: "Undecided",
    revisitYes: "Recommended",
    search: "Search restaurant",
    title: "Gourmet notes",
  },
  ja: {
    allAreas: "すべてのエリア",
    allCuisines: "すべてのジャンル",
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
    average: "平均評価",
    map: "Google マップで開く",
    minimumRating: "すべての評価",
    noPhoto: "写真なし",
    photoPending: "写真を読み込めません",
    retryPhoto: "写真を再読み込み",
    photos: "写真",
    records: "件の記録",
    recommended: "再訪したい店",
    revisit: "再訪",
    revisitFilter: "再訪予定すべて",
    revisitNo: "保留",
    revisitUnknown: "未定",
    revisitYes: "おすすめ",
    search: "店名で検索",
    title: "Gourmetノート",
  },
  ko: {
    allAreas: "모든 지역",
    allCuisines: "모든 장르",
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
    average: "평균 평점",
    map: "Google 지도에서 보기",
    minimumRating: "모든 평점",
    noPhoto: "사진 없음",
    photoPending: "사진을 불러오지 못했습니다",
    retryPhoto: "사진 다시 불러오기",
    photos: "사진",
    records: "개 기록",
    recommended: "재방문 추천",
    revisit: "재방문",
    revisitFilter: "모든 재방문 계획",
    revisitNo: "보류",
    revisitUnknown: "미정",
    revisitYes: "추천",
    search: "식당 이름으로 검색",
    title: "Gourmet 기록",
  },
} satisfies Record<Locale, Record<string, string>>;

function gourmetMapUrl(entry: GourmetEntry) {
  const query = [entry.restaurantName, entry.restaurantBranch, entry.area]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function Rating(props: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-[var(--accent-foreground)]">
      <Star aria-hidden="true" className="size-3.5 fill-current" />
      {props.value.toFixed(1)}
    </span>
  );
}

function GourmetPhoto(props: {
  emptyLabel: string;
  image?: GourmetEntry["images"][number];
  pendingLabel: string;
  priority?: boolean;
  sizes: string;
  fallbackAlt: string;
  retryLabel?: string;
  contain?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!failed || attempt >= 2) return;
    const timer = setTimeout(
      () => {
        setAttempt((value) => value + 1);
        setFailed(false);
      },
      750 * 2 ** attempt,
    );
    return () => clearTimeout(timer);
  }, [failed, attempt]);
  const displayedImage = props.image && !failed ? props.image : undefined;
  const alt = props.image?.altText.trim();
  const meaningfulAlt =
    alt && !/\.(jpe?g|png|webp|heic)$/i.test(alt) && !/^(미상\s*)+$/.test(alt);
  return (
    <div
      className={`relative overflow-hidden bg-[var(--surface)] ${displayedImage ? "aspect-[4/3]" : "grid min-h-32 place-items-center"}`}
    >
      {displayedImage ? (
        <Image
          alt={meaningfulAlt ? alt : props.fallbackAlt}
          className={
            props.contain
              ? "object-contain"
              : "object-cover transition duration-500 group-hover:scale-[1.025]"
          }
          fill
          onError={() => setFailed(true)}
          priority={props.priority}
          sizes={props.sizes}
          src={`${publicGourmetImage(displayedImage)}${attempt ? `${displayedImage.publicPath.includes("?") ? "&" : "?"}retry=${attempt}` : ""}`}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
          <Utensils aria-hidden="true" className="size-5" />
          <span>{props.image ? props.pendingLabel : props.emptyLabel}</span>
          {props.image && props.retryLabel ? (
            <button
              type="button"
              className="min-h-11 px-4 font-semibold text-[var(--ink)] underline"
              onClick={() => {
                setAttempt((value) => value + 1);
                setFailed(false);
              }}
            >
              {props.retryLabel}
            </button>
          ) : null}
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
  const [cuisineTag, setCuisineTag] = useState("");
  const [minimumRating, setMinimumRating] = useState("");
  const [revisit, setRevisit] = useState<"" | GourmetEntry["revisit"]>("");
  const [list, setList] = useState<GourmetList>();
  const [selected, setSelected] = useState<GourmetEntry>();
  const [detailError, setDetailError] = useState(false);
  const [message, setMessage] = useState(labels.loading);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ pageSize: "48" });
    if (query.trim()) params.set("restaurantName", query.trim());
    if (area.trim()) params.set("area", area.trim());
    if (cuisineTag.trim()) params.set("cuisineTag", cuisineTag.trim());
    if (minimumRating) params.set("minRating", minimumRating);
    if (revisit) params.set("revisit", revisit);
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
          setMessage(labels.failed);
      });
    return () => controller.abort();
  }, [area, cuisineTag, labels.failed, minimumRating, query, revisit]);

  useEffect(() => {
    setSelected(undefined);
    setDetailError(false);
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
          setDetailError(true);
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
  const cuisines = useMemo(
    () =>
      [
        ...new Set(list?.entries.flatMap((entry) => entry.cuisineTags) ?? []),
      ].sort(),
    [list],
  );
  const entries = list?.entries ?? [];
  const timeline = useMemo(
    () =>
      gourmetTimeline(
        entries,
        props.locale === "ko"
          ? "ko-KR"
          : props.locale === "ja"
            ? "ja-JP"
            : "en-US",
      ),
    [entries, props.locale],
  );
  if (selectedSlug && (!selected || selected.slug !== selectedSlug))
    return (
      <section className="page-width py-16">
        <Link href={localePath(props.locale, "/gourmet/")}>{labels.back}</Link>
        <p role="status" className="py-8">
          {detailError ? labels.failed : labels.loading}
        </p>
      </section>
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
            <section aria-label={labels.photos} className="grid gap-4">
              {(selected.images.length
                ? [...selected.images].sort((a, b) => a.sortOrder - b.sortOrder)
                : [undefined]
              ).map((image, index) => (
                <GourmetPhoto
                  key={`${selected.id}-${image?.id ?? "empty"}`}
                  emptyLabel={labels.noPhoto}
                  image={image}
                  fallbackAlt={`${selected.restaurantName} · ${selected.menuName} (${index + 1}/${selected.images.length})`}
                  pendingLabel={labels.photoPending}
                  retryLabel={labels.retryPhoto}
                  contain
                  priority={index === 0}
                  sizes="(max-width: 1024px) 100vw, 60vw"
                />
              ))}
            </section>
          </div>
          <div className="order-first min-w-0 self-start lg:order-none">
            <p className="brand-eyebrow text-[var(--accent-foreground)]">
              {gourmetDate(selected)} · {selected.source}
            </p>
            <h1 className="detail-title display-serif mt-4">
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
            <a
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent-foreground)] hover:underline"
              href={gourmetMapUrl(selected)}
              rel="noopener noreferrer"
              target="_blank"
            >
              <MapPin className="size-4" /> {labels.map}
            </a>
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
            {selected.images[0] ? (
              <div className="mt-8 border-y border-[var(--line)] py-5">
                <GourmetShareButton
                  entry={selected}
                  imageUrl={publicGourmetImage(selected.images[0])}
                  locale={props.locale}
                />
              </div>
            ) : null}
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
      <header className="page-heading">
        <div className="page-width">
          <h1>{labels.title}</h1>
        </div>
      </header>
      <section className="page-width gourmet-content">
        <div className="gourmet-filters">
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
          <details className="gourmet-filter-details">
            <summary>
              {props.locale === "ko"
                ? "필터"
                : props.locale === "ja"
                  ? "絞り込み"
                  : "Filters"}
              {[area, cuisineTag, minimumRating, revisit].filter(Boolean)
                .length > 0
                ? ` · ${[area, cuisineTag, minimumRating, revisit].filter(Boolean).length}`
                : ""}
            </summary>
            <div className="gourmet-filter-options">
              <select
                aria-label={labels.allAreas}
                className="border border-[var(--line)] bg-[var(--surface)] px-4"
                onChange={(event) => setArea(event.target.value)}
                value={area}
              >
                <option value="">{labels.allAreas}</option>
                {area && !areas.includes(area) ? (
                  <option value={area}>{area}</option>
                ) : null}
                {areas.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <select
                aria-label={labels.allCuisines}
                className="border border-[var(--line)] bg-[var(--surface)] px-4"
                onChange={(event) => setCuisineTag(event.target.value)}
                value={cuisineTag}
              >
                <option value="">{labels.allCuisines}</option>
                {cuisineTag && !cuisines.includes(cuisineTag) ? (
                  <option value={cuisineTag}>{cuisineTag}</option>
                ) : null}
                {cuisines.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <select
                aria-label={labels.minimumRating}
                className="border border-[var(--line)] bg-[var(--surface)] px-4"
                onChange={(event) => setMinimumRating(event.target.value)}
                value={minimumRating}
              >
                <option value="">{labels.minimumRating}</option>
                <option value="9">9.0+</option>
                <option value="8">8.0+</option>
                <option value="7">7.0+</option>
              </select>
              <select
                aria-label={labels.revisitFilter}
                className="border border-[var(--line)] bg-[var(--surface)] px-4"
                onChange={(event) =>
                  setRevisit(event.target.value as "" | GourmetEntry["revisit"])
                }
                value={revisit}
              >
                <option value="">{labels.revisitFilter}</option>
                <option value="yes">{labels.revisitYes}</option>
                <option value="no">{labels.revisitNo}</option>
                <option value="unknown">{labels.revisitUnknown}</option>
              </select>
            </div>
          </details>
        </div>
        {!message && list ? (
          <p className="py-4 text-sm text-[var(--muted-foreground)]">
            {list.total} {labels.records}
          </p>
        ) : null}
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
        <div className="mt-8 grid gap-12">
          {timeline.map((month) => (
            <section key={month.key}>
              <header className="mb-5 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-3">
                <h2 className="display-serif text-2xl tracking-[-0.035em]">
                  {month.label}
                </h2>
                <span className="text-xs font-bold tracking-[0.12em] text-[var(--muted-foreground)] uppercase">
                  {month.entries.length} {labels.records}
                </span>
              </header>
              <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {month.entries.map((entry) => (
                  <article className="group" key={entry.id}>
                    <Link
                      href={`?entry=${encodeURIComponent(entry.slug)}`}
                      scroll
                    >
                      <GourmetPhoto
                        key={entry.images[0]?.publicPath ?? "empty"}
                        emptyLabel={labels.noPhoto}
                        image={entry.images[0]}
                        fallbackAlt={`${entry.restaurantName} · ${entry.menuName}`}
                        pendingLabel={labels.photoPending}
                        sizes="(max-width: 640px) 100vw, 33vw"
                      />
                      <div className="mt-5 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                            {gourmetDate(entry)}
                            {entry.area ? ` · ${entry.area}` : ""}
                          </p>
                          <h3 className="display-serif mt-2 text-2xl tracking-[-0.035em]">
                            {entry.restaurantName}
                          </h3>
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
                    <a
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--muted-foreground)] hover:text-[var(--accent-foreground)]"
                      href={gourmetMapUrl(entry)}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <MapPin className="size-3" /> {labels.map}
                    </a>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
