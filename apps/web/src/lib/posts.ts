import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";

const postsDirectory = join(process.cwd(), "content/posts");

export type PostCategory = "weekly" | "deep-dive" | "studio-log";
export type ReviewStatus = "unreviewed" | "reviewed";

export const postCategoryMeta: Record<
  PostCategory,
  { description: string; label: string; shortLabel: string }
> = {
  weekly: {
    description: "한 주의 주요 IT 이슈를 맥락과 함께 정리합니다.",
    label: "주간 IT 브리핑",
    shortLabel: "Weekly brief",
  },
  "deep-dive": {
    description: "특정 기술과 제품 개발의 선택을 깊이 있게 기록합니다.",
    label: "테크 딥다이브",
    shortLabel: "Tech deep dive",
  },
  "studio-log": {
    description:
      "Arlequin과 Lumen이 나눈 프롬프트, 결정, 실제 변경 사항을 공개합니다.",
    label: "Backstage · 제작의 기록",
    shortLabel: "Backstage",
  },
};

export type PostFrontmatter = {
  category: PostCategory;
  excerpt: string;
  publishedAt: string;
  readTime: string;
  reviewStatus: ReviewStatus;
  tags: string[];
  title: string;
};

export type PostSummary = PostFrontmatter & { slug: string };

function isMdx(filename: string) {
  return filename.endsWith(".mdx");
}

export async function getPosts(): Promise<PostSummary[]> {
  const files = (await readdir(postsDirectory)).filter(isMdx);
  const posts = await Promise.all(
    files.map(async (filename) => {
      const source = await readFile(join(postsDirectory, filename), "utf8");
      const { data } = matter(source);
      return {
        ...(data as PostFrontmatter),
        slug: filename.replace(/\.mdx$/, ""),
      };
    }),
  );
  return posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getPost(slug: string) {
  try {
    const source = await readFile(join(postsDirectory, `${slug}.mdx`), "utf8");
    const { content, data } = matter(source);
    const compiled = await compileMDX<PostFrontmatter>({
      source: content,
      options: { parseFrontmatter: false },
    });
    return { ...compiled, frontmatter: data as PostFrontmatter, slug };
  } catch {
    return undefined;
  }
}
