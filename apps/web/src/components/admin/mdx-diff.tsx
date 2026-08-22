type DiffLine = {
  kind: "added" | "context" | "removed";
  line: string;
  lineNumber?: number;
};

function changedLines(before: string, after: string): DiffLine[] {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  let prefix = 0;
  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  )
    prefix += 1;

  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix &&
    suffix < afterLines.length - prefix &&
    beforeLines[beforeLines.length - 1 - suffix] ===
      afterLines[afterLines.length - 1 - suffix]
  )
    suffix += 1;

  if (prefix === beforeLines.length && prefix === afterLines.length) return [];

  const contextBefore = Math.max(0, prefix - 2);
  const contextAfterBefore = Math.min(
    beforeLines.length,
    beforeLines.length - suffix + 2,
  );
  const contextAfterAfter = Math.min(
    afterLines.length,
    afterLines.length - suffix + 2,
  );
  const lines: DiffLine[] = [];
  for (let index = contextBefore; index < prefix; index += 1)
    lines.push({
      kind: "context",
      line: beforeLines[index] ?? "",
      lineNumber: index + 1,
    });
  for (let index = prefix; index < beforeLines.length - suffix; index += 1)
    lines.push({
      kind: "removed",
      line: beforeLines[index] ?? "",
      lineNumber: index + 1,
    });
  for (let index = prefix; index < afterLines.length - suffix; index += 1)
    lines.push({
      kind: "added",
      line: afterLines[index] ?? "",
      lineNumber: index + 1,
    });
  const suffixStart = Math.max(beforeLines.length - suffix, prefix);
  const suffixLimit = Math.min(
    contextAfterBefore,
    contextAfterAfter,
    suffixStart + 2,
  );
  for (let index = suffixStart; index < suffixLimit; index += 1)
    lines.push({
      kind: "context",
      line: beforeLines[index] ?? "",
      lineNumber: index + 1,
    });
  return lines;
}

export function MdxDiff({ after, before }: { after: string; before: string }) {
  const lines = changedLines(before, after);
  if (!lines.length)
    return (
      <p className="grid min-h-[20rem] place-content-center text-sm text-[var(--muted-foreground)]">
        기준 리비전과 달라진 내용이 없습니다.
      </p>
    );
  return (
    <div className="min-h-[20rem] overflow-x-auto bg-[var(--night)] py-3 font-mono text-xs text-white">
      {lines.map((line, index) => {
        const marker =
          line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " ";
        const color =
          line.kind === "added"
            ? "bg-emerald-400/15 text-emerald-100"
            : line.kind === "removed"
              ? "bg-red-400/15 text-red-100"
              : "text-white/65";
        return (
          <div
            className={`grid min-w-max grid-cols-[3rem_1.5rem_minmax(32rem,1fr)] px-3 leading-6 ${color}`}
            key={`${line.kind}-${line.lineNumber}-${index}`}
          >
            <span className="select-none text-right text-white/35">
              {line.lineNumber}
            </span>
            <span className="select-none text-center">{marker}</span>
            <span className="whitespace-pre-wrap">{line.line || " "}</span>
          </div>
        );
      })}
    </div>
  );
}
