"use client";

import { Fragment, type ReactNode } from "react";

type MdxPreviewProps = {
  source: string;
};

function inline(value: string): ReactNode[] {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code
          className="rounded bg-[var(--background)] px-1.5 py-0.5 font-mono text-[0.9em]"
          key={`${part}-${index}`}
        >
          {part.slice(1, -1)}
        </code>
      );
    const link = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(part);
    if (link)
      return (
        <span
          className="font-semibold text-[var(--accent-foreground)] underline decoration-dotted underline-offset-4"
          key={`${part}-${index}`}
        >
          {link[1]}
        </span>
      );
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function withoutFrontmatter(source: string) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") return lines;
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  return end > 0 ? lines.slice(end + 1) : [];
}

export function MdxPreview({ source }: MdxPreviewProps) {
  const lines = withoutFrontmatter(source);
  const nodes: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | undefined;
  let code: string[] | undefined;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    nodes.push(
      <p
        className="leading-7 text-[var(--foreground)]"
        key={`p-${nodes.length}`}
      >
        {inline(paragraph.join(" "))}
      </p>,
    );
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    nodes.push(
      <Tag
        className={
          list.ordered
            ? "list-decimal space-y-1 pl-6 leading-7"
            : "list-disc space-y-1 pl-6 leading-7"
        }
        key={`list-${nodes.length}`}
      >
        {list.items.map((item, index) => (
          <li key={`${item}-${index}`}>{inline(item)}</li>
        ))}
      </Tag>,
    );
    list = undefined;
  };
  const flushCode = () => {
    if (!code) return;
    nodes.push(
      <pre
        className="overflow-x-auto rounded-xl bg-[var(--night)] p-4 font-mono text-xs leading-6 text-white"
        key={`code-${nodes.length}`}
      >
        <code>{code.join("\n")}</code>
      </pre>,
    );
    code = undefined;
  };

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      if (code) flushCode();
      else {
        flushParagraph();
        flushList();
        code = [];
      }
      return;
    }
    if (code) {
      code.push(line);
      return;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const [, hashes, headingText] = heading;
      if (!hashes || !headingText) return;
      const level = hashes.length;
      const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      nodes.push(
        <Tag
          className={
            level === 1
              ? "font-serif text-3xl font-black tracking-[-0.03em]"
              : level === 2
                ? "font-serif text-2xl font-black tracking-[-0.02em]"
                : "text-lg font-bold"
          }
          key={`heading-${nodes.length}`}
        >
          {inline(headingText)}
        </Tag>,
      );
      return;
    }
    if (/^\s*---+\s*$/.test(line)) {
      flushParagraph();
      flushList();
      nodes.push(
        <hr className="border-[var(--line)]" key={`hr-${nodes.length}`} />,
      );
      return;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      const quoteText = quote[1];
      if (quoteText === undefined) return;
      nodes.push(
        <blockquote
          className="border-l-2 border-[var(--coral)] pl-4 italic leading-7 text-[var(--muted-foreground)]"
          key={`quote-${nodes.length}`}
        >
          {inline(quoteText)}
        </blockquote>,
      );
      return;
    }
    const item = /^(\s*)([-*]|\d+\.)\s+(.+)$/.exec(line);
    if (item) {
      flushParagraph();
      const marker = item[2];
      const itemText = item[3];
      if (!marker || !itemText) return;
      const ordered = /\d+\./.test(marker);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { items: [], ordered };
      }
      list.items.push(itemText);
      return;
    }
    flushList();
    paragraph.push(line.trim());
  });

  flushParagraph();
  flushList();
  flushCode();

  return (
    <div className="grid gap-5 text-[0.95rem]">
      {nodes.length ? (
        nodes
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">
          원문을 입력하면 여기에 미리보기가 표시됩니다.
        </p>
      )}
    </div>
  );
}
