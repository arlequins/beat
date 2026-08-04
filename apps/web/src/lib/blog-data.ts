export type PortfolioProject = {
  challenge: string;
  description: string;
  highlights: string[];
  image?: string;
  outcome: string;
  repository: string;
  role: string;
  slug: string;
  stack: string[];
  title: string;
  year: string;
};

/** Replace these entries with your own GitHub repositories and career stories. */
export const projects: PortfolioProject[] = [
  {
    challenge:
      "서비스를 시작할 때마다 반복되는 인프라·인증·데이터베이스 설정을 줄이면서도, 나중에 운영에 필요한 품질 기준을 유지하는 일이 과제였습니다.",
    description:
      "확장 가능한 웹·API·데이터베이스 레이어를 한 템플릿으로 정리한 풀스택 모노레포입니다. 제품을 빠르게 시작하면서도 운영 품질을 놓치지 않는 구조를 목표로 했습니다.",
    highlights: [
      "Static Next.js delivery",
      "Hono + tRPC API",
      "PostgreSQL migrations",
    ],
    image: "/portfolio/ai-template-cover.png",
    outcome:
      "정적 포트폴리오부터 API와 데이터베이스가 필요한 제품까지 점진적으로 확장할 수 있는 출발점을 만들었습니다.",
    repository: "https://github.com/arlequins/beat",
    role: "Architecture · Full-stack development",
    slug: "beat-template",
    stack: ["Next.js", "TypeScript", "Hono", "PostgreSQL"],
    title: "Beat — Full-stack product template",
    year: "2026",
  },
  {
    challenge:
      "AI 에이전트가 빠르게 코드를 만들더라도, 사람이 검토하기 쉽고 계속 발전시킬 수 있는 작업 단위와 품질 기준이 필요했습니다.",
    description:
      "AI 에이전트를 제품 개발 파트너로 활용하는 실험 프로젝트입니다. 요구사항을 작게 나누고, 화면·테스트·문서를 함께 갱신하는 흐름을 만들었습니다.",
    highlights: [
      "Task-scoped agent prompts",
      "Build and type-check loop",
      "Human review checkpoints",
    ],
    outcome:
      "반복적인 초기 구현 시간을 줄이는 동시에, 변경 이유와 검증 결과가 코드베이스에 남도록 했습니다.",
    repository: "https://github.com/your-github-id",
    role: "AI-assisted product development",
    slug: "agent-assisted-product-workflow",
    stack: ["Codex", "TypeScript", "Next.js", "Playwright"],
    title: "Agent-assisted product workflow",
    year: "2026",
  },
  {
    challenge:
      "새 프로젝트마다 같은 배포 설정과 문서가 반복되면서, 개인 실험의 결과가 다음 프로젝트로 이어지지 않는 문제가 있었습니다.",
    description:
      "정적 포트폴리오, MDX 기술 블로그, GitHub 메타데이터, Vercel 배포를 한 흐름으로 정리한 개발자 경험 개선 사례입니다.",
    highlights: [
      "MDX content workflow",
      "GitHub metadata fallback",
      "Static Vercel delivery",
    ],
    outcome:
      "새 작업을 공개 가능한 사례 연구와 기술 노트로 전환하는 시간을 줄이고, 개인 학습 기록을 꾸준히 쌓을 기반을 마련했습니다.",
    repository: "https://github.com/your-github-id",
    role: "Developer experience · Content system",
    slug: "portfolio-as-a-product",
    stack: ["MDX", "Vercel", "GitHub API", "SEO"],
    title: "Portfolio as a product",
    year: "2026",
  },
];
