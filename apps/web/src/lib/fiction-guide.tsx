import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ComponentPropsWithoutRef } from "react";

const directory = join(process.cwd(), "content/fiction-guide");
export async function getGuideEntries() {
  const files = (await readdir(directory)).filter((file) =>
    file.endsWith(".md"),
  );
  const entries = await Promise.all(
    files.map(async (file) => {
      const { data } = matter(await readFile(join(directory, file), "utf8"));
      return {
        slug: file.slice(0, -3),
        title: String(data.title),
        order: Number(data.order),
        summary: String(data.summary),
        status: String(data.status),
        revision: String(data.revision),
      };
    }),
  );
  return entries.sort((a, b) => a.order - b.order);
}
export async function getGuideEntry(slug: string) {
  const entry = (await getGuideEntries()).find((item) => item.slug === slug);
  if (!entry) return undefined;
  const { content } = matter(
    await readFile(join(directory, `${entry.slug}.md`), "utf8"),
  );
  return {
    ...entry,
    content: (
      await compileMDX({
        source: content,
        components: {
          pre: (props: ComponentPropsWithoutRef<"pre">) => (
            <pre
              role="region"
              {...props}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: The scrollable map needs keyboard access.
              tabIndex={0}
              aria-label="개략 지도, 좌우 방향키로 이동"
            />
          ),
        },
      })
    ).content,
  };
}
