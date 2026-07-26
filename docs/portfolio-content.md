# Portfolio content

The public portfolio is intentionally static so it can run locally and deploy
to Vercel without a database, API, or identity provider.

## Run locally

```bash
pnpm --filter @acme/web dev
```

Open <http://localhost:3000>. The first run may need `pnpm install` at the
repository root.

## Edit your identity

Update [`apps/web/src/config/site.ts`](../apps/web/src/config/site.ts):

- `name`, `role`, and `intro` for the first screen
- `email` for the contact links
- GitHub and LinkedIn profile URLs

## Add projects and writing

Update [`apps/web/src/lib/blog-data.ts`](../apps/web/src/lib/blog-data.ts):

- `projects` drives the project cards on the home page.
- Each project also receives a statically generated case-study page under
  `/work/<slug>/`.

Write posts as MDX files in
[`apps/web/content/posts`](../apps/web/content/posts). Files become pages at
`/posts/<slug>/`. Frontmatter requires `title`, `excerpt`, `publishedAt`,
`readTime`, `tags`, `category`, and `reviewStatus`:

```mdx
---
title: 글 제목
excerpt: 한 줄 소개
category: weekly # weekly | deep-dive | studio-log
reviewStatus: unreviewed # unreviewed | reviewed
publishedAt: "2026-07-25"
readTime: 5 min read
tags: [AI, Security]
---
```

- `weekly`: 매주 IT 이슈를 맥락과 다음 행동으로 정리하는 **주간 IT 브리핑**입니다.
- `deep-dive`: 특정 기술, 프로젝트의 선택, 문제 해결 과정을 다루는 **테크 딥다이브**입니다.
- `studio-log`: Arlequin과 Lumen의 프롬프트·결정·변경 내역을 공개하는 **Backstage · 제작의 기록**입니다. `Prompt Footage`, `Patch Notes`, `Decision History` 태그로 형식을 구분합니다.
- `unreviewed`: 공개 상태이지만 글 상단에 **미확정본 · 공개 검토 중** 안내를 표시합니다.
- `reviewed`: 최종 검토를 마친 글입니다. 미확정 안내가 사라집니다.

외부 사실을 정리하는 글에는 원문 링크를 함께 남기고, 게시 전에는 제목·날짜·출처·주관적 판단을 확인합니다.

### Backstage editorial rule

- 중요한 사용자 프롬프트와 Lumen의 응답이 제품 방향을 바꾸면 `Prompt Log`로 남깁니다.
- 화면, 기능, 콘텐츠 구조, 배포 방식이 달라지면 `Patch Notes`로 남깁니다.
- 원문 대화는 의미를 바꾸지 않는 범위에서 반복을 줄이고 공개용 맥락을 덧붙입니다.
- 시스템 지침, 비밀값, 개인정보, 로컬 환경 정보, 긴 명령 출력은 게시하지 않습니다.
- 새 Studio Log는 항상 `reviewStatus: unreviewed`로 시작하고 Arlequin의 검토 후 `reviewed`로 전환합니다.

## Languages

Korean is the default language at `/`. English and Japanese pages are statically
generated at `/en/` and `/ja/`; the language control keeps the current page when
switching. User interface copy, projects, post summaries, and the initial
articles are maintained in [`apps/web/src/lib/localized-content.ts`](../apps/web/src/lib/localized-content.ts).
When adding a post, add its English and Japanese record there before publishing.

For each project, focus on the problem, your role, the technical choices, and
the outcome. Add a blog post whenever you want to preserve a technical
decision, debugging story, or implementation note.

## Deploy

The web remains a static Next.js export. Follow the checked-in
[Vercel deployment guide](vercel-deployment.md) when you are ready to connect
the repository to Vercel. The public portfolio does not need the API or Neon
database unless you later enable a CMS, authentication, uploads, or other
dynamic features.

## Optional GitHub metadata

During a production build, the site reads public repository metadata for each
GitHub project card. It always falls back to the local project description when
GitHub is unavailable. Add an optional read-only `GITHUB_TOKEN` to Vercel when
you want a higher GitHub API rate limit; never expose it as a `NEXT_PUBLIC_*`
variable.
