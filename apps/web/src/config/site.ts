import { DEFAULT_LOCALHOST_SITE_URL } from "@arlequins/env/public-defaults";

export const siteConfig = {
  description:
    "A software portfolio and technical journal by Arlequin, built with AI collaborator Lumen.",
  collaborator: "Lumen",
  email: "harlequin.beat@gmail.com",
  intro: "사람이 방향을 정하고, 빛이 가능성을 드러냅니다.",
  links: {
    github: "https://github.com/arlequins",
  },
  legalName: "Wonho An",
  name: "Arlequin",
  role: "Software Engineer · AI-native product builder",
  shortName: "A×L",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_LOCALHOST_SITE_URL,
} as const;

/** Preserve a GitHub Pages project path such as `/beat` in absolute URLs. */
export function siteUrl(path = "") {
  const base = `${siteConfig.url.replace(/\/$/, "")}/`;
  return new URL(path.replace(/^\//, ""), base).toString();
}

/** Prefix public assets for the GitHub Pages project-site base path. */
export function siteAssetPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const basePath = process.env.GITHUB_PAGES === "true" ? "/beat" : "";
  return `${basePath}${normalizedPath}`;
}
