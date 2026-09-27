"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { Story } from "~/lib/fiction";
import type { Locale } from "~/lib/i18n";

type FictionComment = {
  id: string;
  nickname: string;
  body: string;
  spoiler: boolean;
  createdAt: string;
};

type CommentSort = "newest" | "oldest";

const commentStoragePrefix = "beat-fiction-comments-v1";
const prohibitedFragments = [
  "씨발",
  "시발",
  "ㅅㅂ",
  "개새끼",
  "병신",
  "지랄",
  "좆",
  "존나",
  "꺼져",
  "fuck",
  "shit",
  "bitch",
  "asshole",
];

function storageKey(slug: string) {
  return `${commentStoragePrefix}-${slug}`;
}

function normalizeForModeration(value: string) {
  return value
    .toLocaleLowerCase("ko-KR")
    .normalize("NFKC")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function containsProhibitedLanguage(value: string) {
  const normalized = normalizeForModeration(value);
  return prohibitedFragments.some((fragment) => normalized.includes(fragment));
}

function isComment(value: unknown): value is FictionComment {
  if (!value || typeof value !== "object") return false;
  const comment = value as Partial<FictionComment>;
  return (
    typeof comment.id === "string" &&
    typeof comment.nickname === "string" &&
    typeof comment.body === "string" &&
    typeof comment.spoiler === "boolean" &&
    typeof comment.createdAt === "string"
  );
}

function readComments(slug: string) {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(storageKey(slug)) ?? "null",
    );
    return Array.isArray(parsed) ? parsed.filter(isComment) : [];
  } catch {
    return [];
  }
}

function saveComments(slug: string, comments: FictionComment[]) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(comments));
  } catch {
    // The feature remains usable when browser storage is unavailable.
  }
}

function commentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatCommentDate(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return locale === "en"
      ? "Just now"
      : locale === "ja"
        ? "たった今"
        : "방금 전";
  return new Intl.DateTimeFormat(
    locale === "en" ? "en-US" : locale === "ja" ? "ja-JP" : "ko-KR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

export function FictionComments({
  story,
  locale,
}: {
  story: Pick<Story, "slug" | "title">;
  locale: Locale;
}) {
  const text = {
    ko: {
      title: "독자 코멘트",
      sort: "정렬",
      newest: "최신순",
      oldest: "오래된순",
      nickname: "닉네임",
      namePlaceholder: "이름을 남겨 주세요",
      comment: "댓글",
      commentPlaceholder: "이 회차에 대한 생각을 남겨 주세요",
      spoiler: "스포일러 포함",
      submit: "댓글 등록",
      note: "비속어는 등록할 수 없으며, 댓글은 이 브라우저에만 저장됩니다.",
      empty: "첫 번째 코멘트를 남겨 보세요.",
      hidden: "숨긴 코멘트입니다.",
      show: "다시 보기",
      reveal: "스포일러 포함 · 눌러서 보기",
      hide: "숨기기",
      delete: "삭제",
      required: "닉네임과 댓글을 모두 입력해 주세요.",
      nicknameLength: "닉네임은 20자 이내로 입력해 주세요.",
      bodyLength: "댓글은 500자 이내로 입력해 주세요.",
      prohibited: "비속어가 포함된 댓글은 등록할 수 없습니다.",
    },
    en: {
      title: "Reader comments",
      sort: "Sort",
      newest: "Newest",
      oldest: "Oldest",
      nickname: "Nickname",
      namePlaceholder: "Leave a name",
      comment: "Comment",
      commentPlaceholder: "Share your thoughts on this episode",
      spoiler: "Contains spoilers",
      submit: "Post comment",
      note: "Abusive language is not allowed. Comments are stored only in this browser.",
      empty: "Be the first to leave a comment.",
      hidden: "Comment hidden.",
      show: "Show again",
      reveal: "Spoiler · click to reveal",
      hide: "Hide",
      delete: "Delete",
      required: "Enter both a nickname and comment.",
      nicknameLength: "Nicknames must be 20 characters or fewer.",
      bodyLength: "Comments must be 500 characters or fewer.",
      prohibited: "Comments containing abusive language cannot be posted.",
    },
    ja: {
      title: "読者コメント",
      sort: "並び順",
      newest: "新しい順",
      oldest: "古い順",
      nickname: "ニックネーム",
      namePlaceholder: "名前を入力してください",
      comment: "コメント",
      commentPlaceholder: "この話の感想をお聞かせください",
      spoiler: "ネタバレを含む",
      submit: "コメントを投稿",
      note: "不適切な言葉は投稿できません。コメントはこのブラウザーにのみ保存されます。",
      empty: "最初のコメントを残してください。",
      hidden: "非表示のコメントです。",
      show: "再表示",
      reveal: "ネタバレあり · タップして表示",
      hide: "非表示",
      delete: "削除",
      required: "ニックネームとコメントを入力してください。",
      nicknameLength: "ニックネームは20文字以内で入力してください。",
      bodyLength: "コメントは500文字以内で入力してください。",
      prohibited: "不適切な言葉を含むコメントは投稿できません。",
    },
  }[locale];
  const [comments, setComments] = useState<FictionComment[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [nickname, setNickname] = useState("");
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [sort, setSort] = useState<CommentSort>("newest");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    setComments(readComments(story.slug));
    setHydrated(true);
  }, [story.slug]);

  const orderedComments = useMemo(
    () =>
      [...comments].sort((a, b) => {
        const direction = sort === "newest" ? -1 : 1;
        return direction * a.createdAt.localeCompare(b.createdAt);
      }),
    [comments, sort],
  );

  const updateComments = (next: FictionComment[]) => {
    setComments(next);
    saveComments(story.slug, next);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanNickname = nickname.trim();
    const cleanBody = body.trim();
    if (!cleanNickname || !cleanBody) {
      setError(text.required);
      return;
    }
    if (cleanNickname.length > 20) {
      setError(text.nicknameLength);
      return;
    }
    if (cleanBody.length > 500) {
      setError(text.bodyLength);
      return;
    }
    if (containsProhibitedLanguage(`${cleanNickname} ${cleanBody}`)) {
      setError(text.prohibited);
      return;
    }

    updateComments([
      {
        id: commentId(),
        nickname: cleanNickname,
        body: cleanBody,
        spoiler,
        createdAt: new Date().toISOString(),
      },
      ...comments,
    ]);
    setBody("");
    setSpoiler(false);
    setError("");
  };

  return (
    <section
      className="fiction-comments"
      aria-labelledby="fiction-comments-title"
    >
      <header className="fiction-comments-header">
        <div>
          <p className="fiction-comments-kicker">{story.title}</p>
          <h3 id="fiction-comments-title">{text.title}</h3>
        </div>
        <label className="fiction-comments-sort">
          <span>{text.sort}</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as CommentSort)}
          >
            <option value="newest">{text.newest}</option>
            <option value="oldest">{text.oldest}</option>
          </select>
        </label>
      </header>

      <form className="fiction-comments-form" onSubmit={submit}>
        <div className="fiction-comments-fields">
          <label>
            {text.nickname}
            <input
              value={nickname}
              maxLength={20}
              autoComplete="nickname"
              placeholder={text.namePlaceholder}
              onChange={(event) => setNickname(event.target.value)}
            />
          </label>
          <label>
            {text.comment}
            <textarea
              value={body}
              maxLength={500}
              rows={4}
              placeholder={text.commentPlaceholder}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
        </div>
        <div className="fiction-comments-form-footer">
          <label className="fiction-comments-checkbox">
            <input
              type="checkbox"
              checked={spoiler}
              onChange={(event) => setSpoiler(event.target.checked)}
            />
            <span>{text.spoiler}</span>
          </label>
          <span className="fiction-comments-count">{body.length}/500</span>
          <button type="submit">{text.submit}</button>
        </div>
        <p className="fiction-comments-note">{text.note}</p>
        {error && (
          <p className="fiction-comments-error" role="alert">
            {error}
          </p>
        )}
      </form>

      {!hydrated ? null : orderedComments.length === 0 ? (
        <p className="fiction-comments-empty">{text.empty}</p>
      ) : (
        <ol className="fiction-comments-list">
          {orderedComments.map((comment) =>
            hidden.has(comment.id) ? (
              <li
                className="fiction-comment fiction-comment-hidden"
                key={comment.id}
              >
                <span>{text.hidden}</span>
                <button
                  type="button"
                  onClick={() =>
                    setHidden((current) => {
                      const next = new Set(current);
                      next.delete(comment.id);
                      return next;
                    })
                  }
                >
                  {text.show}
                </button>
              </li>
            ) : (
              <li className="fiction-comment" key={comment.id}>
                <header>
                  <strong>{comment.nickname}</strong>
                  <time dateTime={comment.createdAt}>
                    {formatCommentDate(comment.createdAt, locale)}
                  </time>
                </header>
                {comment.spoiler && !revealed.has(comment.id) ? (
                  <button
                    className="fiction-comment-spoiler"
                    type="button"
                    onClick={() =>
                      setRevealed((current) => new Set(current).add(comment.id))
                    }
                  >
                    {text.reveal}
                  </button>
                ) : (
                  <p>{comment.body}</p>
                )}
                <footer>
                  <button
                    type="button"
                    onClick={() =>
                      setHidden((current) => new Set(current).add(comment.id))
                    }
                  >
                    {text.hide}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateComments(
                        comments.filter((item) => item.id !== comment.id),
                      )
                    }
                  >
                    {text.delete}
                  </button>
                </footer>
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}
