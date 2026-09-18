import { type PortfolioProject, projects } from "~/lib/blog-data";
import type { Locale } from "~/lib/i18n";

export type LocalizedProjectCopy = {
  challenge: string;
  description: string;
  highlights: string[];
  outcome: string;
  role: string;
  title: string;
};

const copy: Record<
  Exclude<Locale, "ko">,
  Record<string, LocalizedProjectCopy>
> = {
  en: {
    "beat-template": {
      title: "Beat — Full-stack product template",
      description:
        "A full-stack monorepo that makes it possible to start fast without discarding operational quality later.",
      challenge:
        "Repeated setup for infrastructure, authentication, and data slowed new products down. The challenge was to reduce that work without lowering the operational bar.",
      highlights: [
        "Static Next.js delivery",
        "Hono + tRPC API",
        "PostgreSQL migrations",
      ],
      outcome:
        "A reusable foundation that can grow from a static portfolio into products with APIs and databases.",
      role: "Architecture · Full-stack development",
    },
    "agent-assisted-product-workflow": {
      title: "Agent-assisted product workflow",
      description:
        "An experiment in using an AI agent as a product-development partner with human review checkpoints.",
      challenge:
        "AI agents can produce code quickly, but the work still needs reviewable tasks, clear quality checks, and human decision points.",
      highlights: [
        "Task-scoped agent prompts",
        "Build and type-check loop",
        "Human review checkpoints",
      ],
      outcome:
        "A repeatable workflow that keeps the reason for each change and its verification close to the code.",
      role: "AI-assisted product development",
    },
    "portfolio-as-a-product": {
      title: "Portfolio as a product",
      description:
        "A static portfolio, MDX writing system, GitHub metadata, and GitHub Pages delivery designed as one developer experience.",
      challenge:
        "Repeated deployment setup and documentation made it hard to carry lessons from one personal project into the next.",
      highlights: [
        "MDX content workflow",
        "GitHub metadata fallback",
        "Static GitHub Pages delivery",
      ],
      outcome:
        "A workflow for turning project work into public case studies and technical notes, while keeping the portfolio maintainable.",
      role: "Developer experience · Content system",
    },
  },
  ja: {
    "beat-template": {
      title: "Beat — フルスタック製品テンプレート",
      description:
        "運用品質を保ちながら、製品開発を素早く始められるフルスタック・モノレポです。",
      challenge:
        "インフラ、認証、データの初期設定を繰り返す負担を減らしつつ、運用に必要な品質を保つことが課題でした。",
      highlights: [
        "Static Next.js delivery",
        "Hono + tRPC API",
        "PostgreSQL migrations",
      ],
      outcome:
        "静的ポートフォリオから API やデータベースを使う製品まで、段階的に拡張できる基盤を整えました。",
      role: "アーキテクチャ · フルスタック開発",
    },
    "agent-assisted-product-workflow": {
      title: "エージェント支援の製品開発ワークフロー",
      description:
        "人によるレビューの節目を保ちながら、AI エージェントを製品開発の協働者として活用する取り組みです。",
      challenge:
        "AI エージェントは素早くコードを作れますが、レビュー可能なタスク、品質確認、判断の節目を明確にする必要があります。",
      highlights: [
        "タスク単位のエージェント指示",
        "ビルドと型チェックの反復",
        "人によるレビューの節目",
      ],
      outcome:
        "変更の理由と検証結果をコードの近くに残す、再現可能な開発の流れを整えました。",
      role: "AI 支援による製品開発",
    },
    "portfolio-as-a-product": {
      title: "プロダクトとしてのポートフォリオ",
      description:
        "静的ポートフォリオ、MDX の執筆環境、GitHub メタデータ、GitHub Pages 配信を一つの開発体験として設計しました。",
      challenge:
        "プロジェクトごとにデプロイ設定やドキュメントを繰り返し、個人開発の学びを次の仕事へつなげにくい課題がありました。",
      highlights: [
        "MDX コンテンツの執筆フロー",
        "GitHub メタデータのフォールバック",
        "GitHub Pages による静的配信",
      ],
      outcome:
        "成果を公開できる事例や技術ノートへ継続的にまとめながら、保守しやすいポートフォリオを実現しました。",
      role: "開発者体験 · コンテンツシステム",
    },
  },
};

export function localizedProjectCopy(
  locale: Locale,
  project: PortfolioProject,
): LocalizedProjectCopy {
  const authoredProject =
    projects.find((item) => item.slug === project.slug) ?? project;
  if (locale === "ko") {
    return {
      challenge: authoredProject.challenge,
      description: authoredProject.description,
      highlights: authoredProject.highlights,
      outcome: authoredProject.outcome,
      role:
        authoredProject.slug === "beat-template"
          ? "아키텍처 · 풀스택 개발"
          : authoredProject.slug === "agent-assisted-product-workflow"
            ? "AI 협업 제품 개발"
            : "개발자 경험 · 콘텐츠 시스템",
      title:
        authoredProject.slug === "beat-template"
          ? "Beat — 풀스택 제품 템플릿"
          : authoredProject.slug === "agent-assisted-product-workflow"
            ? "AI 협업 제품 개발 워크플로"
            : "제품으로서의 포트폴리오",
    };
  }

  return (
    copy[locale][authoredProject.slug] ?? {
      challenge: authoredProject.challenge,
      description: authoredProject.description,
      highlights: authoredProject.highlights,
      outcome: authoredProject.outcome,
      role: authoredProject.role,
      title: authoredProject.title,
    }
  );
}

export function projectPrimaryLink(project: PortfolioProject, locale: Locale) {
  if (project.liveSite) {
    return {
      href: project.liveSite,
      label:
        locale === "ko"
          ? "공개 사이트 보기"
          : locale === "ja"
            ? "公開サイトを見る"
            : "Open live site",
    };
  }
  if (project.repository) {
    return {
      href: project.repository,
      label:
        locale === "ko"
          ? "GitHub 저장소 보기"
          : locale === "ja"
            ? "GitHub リポジトリを見る"
            : "View GitHub repository",
    };
  }
  return undefined;
}
