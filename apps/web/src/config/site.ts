export const siteConfig = {
  description:
    "Arlequin과 AI 협업자 Lumen이 함께 만드는 소프트웨어 포트폴리오와 기술 노트.",
  collaborator: "Lumen",
  email: "wonho@example.com",
  intro: "사람이 방향을 정하고, 빛이 가능성을 드러냅니다.",
  links: {
    github: "https://github.com/arlequins",
    linkedin: "https://www.linkedin.com/in/your-linkedin-id",
  },
  legalName: "Wonho An",
  name: "Arlequin",
  role: "Software Engineer · AI-native product builder",
  shortName: "A×L",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

/** Preserve a GitHub Pages project path such as `/beat` in absolute URLs. */
export function siteUrl(path = "") {
  const base = `${siteConfig.url.replace(/\/$/, "")}/`;
  return new URL(path.replace(/^\//, ""), base).toString();
}
