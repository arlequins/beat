import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";

const directory = join(process.cwd(), "content/fiction");
export type Story = {
  slug: string;
  title: string;
  series: string;
  episode: string;
  publishedAt: string;
  readTime: string;
};
export async function getStories(): Promise<Story[]> {
  const files = (await readdir(directory)).filter((file) =>
    file.endsWith(".mdx"),
  );
  const stories = await Promise.all(
    files.map(async (file) => {
      const { data } = matter(await readFile(join(directory, file), "utf8"));
      return { ...data, slug: file.replace(/\.mdx$/, "") } as Story;
    }),
  );
  return stories.sort((a, b) => a.episode.localeCompare(b.episode));
}
export async function getStory(slug: string) {
  const story = (await getStories()).find((item) => item.slug === slug);
  if (!story) return undefined;
  const { content } = matter(
    await readFile(join(directory, `${story.slug}.mdx`), "utf8"),
  );
  const compiled = await compileMDX({ source: content });
  return { ...story, content: compiled.content };
}
