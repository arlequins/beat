import type { MetadataRoute } from "next";

import { siteConfig } from "~/config/site";
import { getProjects } from "~/lib/github";
import { localePath, locales } from "~/lib/i18n";
import { getPosts } from "~/lib/posts";

export const dynamic = "force-static";

function absoluteUrl(path: string) {
  return new URL(path, siteConfig.url).toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, projects] = await Promise.all([getPosts(), getProjects()]);
  const staticPages = locales.flatMap((locale) => [
    localePath(locale),
    localePath(locale, "/posts/"),
    localePath(locale, "/gourmet/"),
  ]);
  const workPages = locales.flatMap((locale) =>
    projects.map((project) => localePath(locale, `/work/${project.slug}/`)),
  );
  const postPages = locales.flatMap((locale) =>
    posts.map((post) => ({
      lastModified: new Date(`${post.publishedAt}T00:00:00.000Z`),
      url: localePath(locale, `/posts/${post.slug}/`),
    })),
  );

  return [
    ...staticPages.map((url) => ({
      changeFrequency: "weekly" as const,
      priority: url === "/" ? 1 : 0.8,
      url: absoluteUrl(url),
    })),
    ...workPages.map((url) => ({
      changeFrequency: "monthly" as const,
      priority: 0.7,
      url: absoluteUrl(url),
    })),
    ...postPages.map(({ lastModified, url }) => ({
      changeFrequency: "monthly" as const,
      lastModified,
      priority: 0.6,
      url: absoluteUrl(url),
    })),
  ];
}
