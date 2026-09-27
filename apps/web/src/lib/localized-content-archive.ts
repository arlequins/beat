import type { LocalizedArticle } from "~/lib/localized-content";

type Source = { label: string; url: string };

function article(
  title: string,
  excerpt: string,
  intro: string,
  sections: Array<[heading: string, paragraph: string]>,
  sources: Source[],
  links?: Array<{ label: string; slug: string }>,
  linksHeading = "Explore the reading map's individual issues and recommended order",
): LocalizedArticle {
  return {
    title,
    excerpt,
    intro,
    sections: sections.map(([heading, paragraph]) => ({
      heading,
      paragraphs: [paragraph],
    })),
    sources,
    ...(links
      ? {
          links,
          linksHeading,
        }
      : {}),
  };
}

const english: Record<string, LocalizedArticle> = {
  "frontend-issues-2025-create-react-app-sunset": article(
    "2025 Frontend Issue 01 — What Create React App's sunset leaves us to consider",
    "Why the React team no longer recommends Create React App for new projects, and what to consider when choosing the tools for an app.",
    "The React team stopped recommending Create React App for new applications in February 2025. This does not mean React is over. It reflects how frameworks and build tools can better support an app's screens, routing, and deployment.",
    [
      [
        "Choose around operational boundaries",
        "Choosing a framework involves more than deciding whether to use SSR. Document whether you need a static export, where server functions will run, and who owns cache invalidation and observability. Vite with static hosting may be enough for a small site; Next.js or another framework may fit better when you need data, routing, or server components.",
      ],
      [
        "What to do next",
        "Before rebuilding an existing CRA app, document its build process and check its tests, environment variables, and deployment artifacts. For a new app, choose the server capabilities and deployment environment you need instead of stopping at a “React template.”",
      ],
    ],
    [
      {
        label: "Sunsetting Create React App",
        url: "https://react.dev/blog/2025/02/14/sunsetting-create-react-app",
      },
    ],
  ),
  "frontend-issues-2025-eslint-flat-config": article(
    "2025 Frontend Issue 07 — What to check when moving to ESLint flat config",
    "A practical sequence for moving ESLint settings to flat config and preparing for the end of eslintrc support.",
    "Flat config uses arrays and `defineConfig` to combine rules by file pattern. Teams used to `.eslintrc` inheritance and ignore rules should do more than convert the syntax: they should check and document which rules apply to each file.",
    [
      [
        "A sequence for TypeScript monorepos",
        "Separate the role of each package's `eslint.config.*` from shared presets. Then configure the TypeScript parser, React rules, and test globals for the right file patterns. Finally, compare lint results from the repository root and each package in CI.",
      ],
      [
        "Define the contract before v10",
        "ESLint 10 plans to remove eslintrc files and related CLI options. Moving early helps catch missing rules and lets you check whether custom plugins depend on APIs scheduled for removal.",
      ],
    ],
    [
      {
        label: "Evolving flat config",
        url: "https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/",
      },
      {
        label: "What's coming in ESLint v10",
        url: "https://eslint.org/blog/2025/10/whats-coming-in-eslint-10.0.0/",
      },
    ],
  ),
  "frontend-issues-2025-interop-ui": article(
    "2025 Frontend Issue 10 — How browser-native UI changes design systems",
    "Use Popover, customizable select, and anchor positioning to reduce JavaScript dependencies in a design system.",
    "Selects, popovers, and anchored menus are common, but implementing focus, dismissal, and viewport-edge behavior has traditionally taken work. In 2025, more browsers began to support the Popover API and anchor positioning reliably.",
    [
      [
        "Move responsibility into the right layer",
        "When browsers provide default behavior, a design system can focus on color, spacing, motion, and product-specific rules. Still check that components wrapping native APIs preserve accessible names and keyboard behavior.",
      ],
      [
        "A measured adoption path",
        "Check Baseline support in the browsers you target and look for overlap with existing polyfills. Move one menu to the native API first, then compare keyboard, screen-reader, and mobile behavior before changing every component.",
      ],
    ],
    [
      {
        label: "What's New in Web UI: I/O 2025",
        url: "https://developer.chrome.com/blog/new-in-web-ui-io-2025-recap",
      },
    ],
  ),
  "frontend-issues-2025-interop": article(
    "2025 Frontend Issue 06 — How Interop 2025 changed browser choices",
    "A look at anchor positioning, transitions, and navigation as features to validate together across browsers.",
    "Interop 2025 selected anchor positioning, the View Transition API, Navigation API, `@scope`, and WebAssembly for joint browser testing. The value is not just a longer feature list: teams can assess support against shared criteria.",
    [
      [
        "Libraries take on a different role",
        "As browsers stabilize features that handle placement, focus, and dismissal, UI libraries can concentrate more on styling and product patterns. Accessibility testing still matters; validate native behavior in real user journeys.",
      ],
      [
        "Use Baseline as a team vocabulary",
        "Instead of calling supported browsers “modern,” document Baseline status together with your own usage data. Use progressive enhancement for suitable features and validate less stable ones in an experimental path.",
      ],
    ],
    [{ label: "Interop 2025", url: "https://web.dev/blog/interop-2025" }],
  ),
  "frontend-issues-2025-node-24": article(
    "2025 Frontend Issue 05 — How Node.js 24 affects frontend tooling",
    "What Node.js 24 changes mean for development servers, tests, and frontend tools.",
    "Node.js 24 includes V8 13.6 and npm 11. It makes `URLPattern` available globally and changes the default implementation of `AsyncLocalStorage`. Even teams focused on browser code need to check the Node.js versions required by their dev server, test tools, and prerendering environment.",
    [
      [
        "Async context matters",
        "AsyncContextFrame affects how context moves between asynchronous work, including request tracing and logging. Check how your framework handles the change so local and CI results do not diverge.",
      ],
      [
        "Before the LTS transition",
        "Add the Current version to CI to check compatibility before adopting it in production. Manage the package manager, native modules, and Playwright browser versions together, then revisit adoption before the October LTS transition.",
      ],
    ],
    [
      {
        label: "Node.js 24.0.0",
        url: "https://nodejs.org/en/blog/release/v24.0.0",
      },
    ],
  ),
  "frontend-issues-2025-react-19-2": article(
    "2025 Frontend Issue 03 — Activity and screen lifecycles in React 19.2",
    "How Activity, useEffectEvent, and Performance Tracks help preserve screen state and measure work.",
    "React 19.2's `<Activity />` can hide a screen instead of removing it and lower the priority of work on that screen. It adds another way to preserve the state of tabs or forms that users may return to.",
    [
      [
        "Clearer effect timing and performance records",
        "`useEffectEvent` helps distinguish logic driven by user events from effects that respond to rendering. Performance Tracks make React work easier to inspect in browser performance recordings. Both encourage teams to understand when work runs before optimizing it.",
      ],
      [
        "Questions to ask before adopting",
        "Check how a hidden screen affects memory and accessibility before using Activity. Before changing an effect, decide whether it synchronizes an external system or responds to a user event. A new API is valuable when it improves state preservation or measurement, not simply because its syntax looks appealing.",
      ],
    ],
    [
      {
        label: "React 19.2",
        url: "https://react.dev/blog/2025/10/01/react-19-2",
      },
    ],
  ),
  "frontend-issues-2025-react-compiler": article(
    "2025 Frontend Issue 02 — Costs that remain after adopting React Compiler",
    "Why performance measurement and component design still matter when React Compiler automates memoization.",
    "React Compiler 1.0 reached stable release. It analyzes components and hooks to apply memoization where needed. Developers can write rendering code with a clear purpose instead of adding `useMemo` and `useCallback` by habit.",
    [
      [
        "Automation does not replace design",
        "The compiler does not fix expensive calculations, excessive global state, network boundaries, or incorrect keys. Measure interaction delays and render counts in the same scenarios before and after adoption. Record why any skipped code was excluded.",
      ],
      [
        "Adopt it safely",
        "Add the linter and compiler settings to CI, then apply the compiler selectively to a small screen. If performance gets worse, revisit component responsibilities and data flow before adding manual memoization. Judge automatic optimization by measurable user experience, not by reduced lines of code.",
      ],
    ],
    [
      {
        label: "React Compiler v1.0",
        url: "https://react.dev/blog/2025/10/07/react-compiler-1",
      },
    ],
  ),
  "frontend-issues-2025-rsc-security": article(
    "2025 Frontend Issue 08 — Lessons from the React Server Components security patch",
    "How an RSC protocol vulnerability connected framework updates, SBOMs, and deployment verification.",
    "The React Server Components vulnerability disclosed in December 2025 showed that serialization protocols between server and browser can also be attack surfaces. Classifying it only as a “frontend dependency” can hide risk in the server runtime.",
    [
      [
        "A patch PR is only the beginning",
        "After updating a package, verify that the lockfile, build artifacts, and running servers use the same version. Whether or not you use the vulnerable path, move to the official patched version and replace cached images and functions.",
      ],
      [
        "Reduce the next incident's impact",
        "Add a software bill of materials (SBOM) and dependency review to CI, and separate security release alerts from ordinary feature changes. Apps using RSC, server actions, or serialization boundaries need regression tests for server error handling and authorization as well as client tests.",
      ],
    ],
    [
      {
        label: "Critical Security Vulnerability in React Server Components",
        url: "https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components",
      },
    ],
  ),
  "frontend-issues-2025-vite-7": article(
    "2025 Frontend Issue 04 — Vite 7 and the reality of the ESM transition",
    "How to prepare for Vite 7's Node.js requirements, ESM transition, and Baseline browser target.",
    "Vite 7 requires Node.js 20.19 or newer, or 22.12 or newer, and drops Node.js 18 support. It ships as ESM-only and uses Node.js support for `require(esm)`. When upgrading the build tool, check the Node.js version used in both development and CI.",
    [
      [
        "Baseline Widely Available becomes the default",
        "The default browser target changes from `modules` to `baseline-widely-available`. Baseline offers a shared way to decide how far back browser support should reach. If you support embedded browsers or WebViews, confirm that the default matches your requirements.",
      ],
      [
        "Experiment before upgrading",
        "Choose a Node.js version first, then test CommonJS plugins, Vitest, and SSR adapters together. After changing browser targets, compare bundle size and behavior in supported browsers. The ESM transition affects the toolchain, not just one setting.",
      ],
    ],
    [
      {
        label: "Vite 7.0 is out!",
        url: "https://vite.dev/blog/announcing-vite7",
      },
    ],
  ),
  "frontend-issues-2025-webassembly-boundary": article(
    "2025 Frontend Issue 09 — Running server frameworks in the browser with WebAssembly",
    "What WebAssembly makes possible in the browser, and the performance and caching costs to consider.",
    "Running a server framework in the browser with WebAssembly shows how parts of an application can run on a user's device. It can reduce network round trips and work offline, but costs include large binaries, memory use, and startup time.",
    [
      [
        "Boundaries frontend teams should own",
        "Define the input and permissions available to a Wasm module, and measure serialization costs when exchanging data with JavaScript. Version cached modules so they do not run stale code, and provide a server fallback when local execution fails.",
      ],
      [
        "Start with a small experiment",
        "Choose a bounded task such as document conversion, search, or image processing. Moving one high-value task is easier to evaluate than moving an entire backend into the browser.",
      ],
    ],
    [
      {
        label: "Ruby on Rails on WebAssembly",
        url: "https://web.dev/blog/ruby-on-rails-on-webassembly",
      },
    ],
  ),
  "frontend-issues-2026-agent-first-docs": article(
    "2026 Frontend Issue 18 — Documentation is an agent's first path into a project",
    "How AGENTS.md and Markdown documentation endpoints change the way people and agents use frameworks.",
    "Version-specific `AGENTS.md` files, Markdown documentation, and actionable error messages help agents avoid relying on outdated articles or guesses. Once agents use a framework, making its documentation easy to find and keeping it current become part of product quality.",
    [
      [
        "People benefit too",
        "Documentation that agents can read also helps people find and verify what they need. Briefly describe command prerequisites, which files will change, and what to do when a command fails. That supports onboarding and incident response alike.",
      ],
      [
        "Apply it in a repository",
        "Keep shared principles at the repository root and document app- and package-specific versions and commands in their own locations. Leave secrets and personal environment settings out. Run documented commands in CI to catch gaps between instructions and actual behavior.",
      ],
    ],
    [
      {
        label: "Next.js 16.3 AI Improvements",
        url: "https://nextjs.org/blog/next-16-3-ai-improvements",
      },
    ],
  ),
  "frontend-issues-2026-instant-navigation": article(
    "2026 Frontend Issue 19 — The cache design behind Next.js Instant Navigation",
    "How faster navigation and partial data prefetching affect server and client caches in Next.js 16.3.",
    "Next.js 16.3 introduced choosing Stream, Cache, or Block behavior to make navigation feel faster, along with partial data prefetching. Users can move around with SPA-like speed, while developers decide which shared UI to reuse and which data to fetch again.",
    [
      [
        "Cache boundaries are security boundaries",
        "Broad caching can expose user-specific or permission-protected data. Treating every screen as Block can also remove the benefit of the feature. Manage routes, cookies, cache tags, and revalidation windows together.",
      ],
      [
        "What to measure",
        "Compare TTFB, INP, and data freshness on a first visit and a return visit with the same account. Check that back navigation and slow mobile networks do not show stale screens, and make cache-refresh failures visible in logs.",
      ],
    ],
    [
      {
        label: "Next.js 16.3 Instant Navigations",
        url: "https://nextjs.org/blog/next-16-3-instant-navigations",
      },
    ],
  ),
  "frontend-issues-2026-next-adapters": article(
    "2026 Frontend Issue 11 — Next.js Adapter API and platform-specific delivery",
    "How the Adapter API changes the roles of frameworks and cloud platforms during deployment.",
    "Next.js 16.2 stabilized the Adapter API. It gives platforms a versioned format describing routes, prerendered output, static assets, execution environments, and cache rules, so hosts do not have to infer framework internals.",
    [
      [
        "Platform independence has real costs",
        "An adapter does not make every deployment identical. Streaming, images, cache invalidation, and function duration still vary by platform. Contract tests should compare adapter output with actual response headers and cache behavior before deployment.",
      ],
      [
        "A sequence for teams",
        "Separate static and server routes, then record which platform features each deployment uses. Build the same test fixtures with multiple adapters and compare routing and caching. Abstraction should make differences visible and verifiable, not hide them.",
      ],
    ],
    [
      {
        label: "Next.js Across Platforms",
        url: "https://nextjs.org/blog/nextjs-across-platforms",
      },
    ],
  ),
  "frontend-issues-2026-next-agent-ready": article(
    "2026 Frontend Issue 12 — A Next.js project agents can read and change",
    "How AGENTS.md, browser logs, and MCP help agents work in a Next.js development environment.",
    "Next.js provides version-matched guidance in `AGENTS.md` and can forward browser logs to the terminal. Browser tools for inspecting React state and MCP are also being explored. These changes help agents check framework rules and real runtime errors before editing code.",
    [
      [
        "Turn “fix it” into reproducible input",
        "A consistent package of URL, logs, component state, and reproduction steps is easier to validate than copied browser errors. Logs that contain tokens or personal data can turn a developer convenience into a new information leak.",
      ],
      [
        "Set minimum project boundaries",
        "Document repository instructions, commands that should actually be run, files that must not be changed, and rules for handling secrets. Separate agent permissions for reading, writing, and deployment, and keep final merge decisions with a person.",
      ],
    ],
    [
      {
        label: "Building Next.js for an agentic future",
        url: "https://nextjs.org/blog/agentic-future",
      },
      {
        label: "Next.js 16.2 AI improvements",
        url: "https://nextjs.org/blog/next-16-2-ai",
      },
    ],
  ),
  "frontend-issues-2026-next-security": article(
    "2026 Frontend Issue 13 — Preparing for regular Next.js security patches",
    "A practical process for applying Next.js security patches promptly and checking the deployed environment.",
    "Starting in 2026, Next.js introduced a more regular process for security patches and advance notices. Operations teams should keep checking supported release lines instead of waiting only for feature launches.",
    [
      [
        "Verify artifacts, not just version numbers",
        "Changing `package.json` is not enough. Check that the lockfile, Docker image, Lambda bundle, CDN cache, and source maps point to the same patched version. Smoke-test real URLs, headers, RSC responses, and static assets.",
      ],
      [
        "Automate a small, clear process",
        "Label Dependabot or Renovate changes for security, run tests, then deploy through the defined approval steps. Keep deployment artifacts and database migrations separate enough to make a return to the previous build possible.",
      ],
    ],
    [
      {
        label: "July 2026 Security Release",
        url: "https://nextjs.org/blog/july-2026-security-release",
      },
    ],
  ),
  "frontend-issues-2026-node-26-temporal": article(
    "2026 Frontend Issue 14 — Handling dates and time zones with Temporal",
    "How Temporal's availability changes Date handling in frontend code, SSR, and data serialization.",
    "Node.js 26 makes the Temporal API available without extra configuration. A standard API for time zones, calendars, and immutable values that were ambiguous with `Date` is now part of the server runtime.",
    [
      [
        "Keep SSR and browsers aligned",
        "Even when the server uses `Temporal.ZonedDateTime`, define the format when serializing it to JSON. Decide whether browsers support the API, how large a polyfill is acceptable, and which time zone the UI should show. Using the new API only on the server can produce different hydration output.",
      ],
      [
        "An adoption checklist",
        "Start with date behavior in features where time zones matter, such as accounting or reservations. Separate UTC instants from display time zones in APIs. Apply Temporal in a new module first and add serialization tests instead of replacing every `Date` at once.",
      ],
    ],
    [
      {
        label: "Node.js 26.0.0",
        url: "https://nodejs.org/en/blog/release/v26.0.0",
      },
    ],
  ),
  "frontend-issues-2026-react-foundation": article(
    "2026 Frontend Issue 16 — The React Foundation and ecosystem governance",
    "How the React Foundation changes the questions teams ask about ecosystem decisions and long-term compatibility.",
    "The React Foundation is an effort to steward React and related projects under the Linux Foundation. Product teams should understand who decides licensing, releases, and compatibility, and through which process.",
    [
      [
        "From company dependency to ecosystem agreement",
        "Teams that followed one company's roadmap may also want to track maintainers, the RFC process, and the role of key partners. There is no need to revisit every choice, but keep internal components behind public APIs and upgrade boundaries instead of depending on experimental features.",
      ],
      [
        "Questions to keep in a portfolio",
        "When recording a technology choice, ask not only “who built it?” but also “who keeps validating it, and how will compatibility problems be handled?” Governance cannot guarantee the future, but it can help teams understand changes and their response options.",
      ],
    ],
    [
      {
        label: "Introducing the React Foundation",
        url: "https://react.dev/blog/2025/10/07/introducing-the-react-foundation",
      },
    ],
  ),
  "frontend-issues-2026-rsc-security-followup": article(
    "2026 Frontend Issue 17 — Follow-up RSC vulnerabilities: verify the patch is complete",
    "Operational checks to make after responding to follow-up React Server Components DoS and source-exposure vulnerabilities.",
    "After the December 2025 response to RSC vulnerabilities, follow-up notices covered denial of service and source-code exposure. Vulnerability response is an ongoing check of impact and patch completeness, not a single `npm install`.",
    [
      [
        "Stale caches can delay a fix",
        "When server functions, RSC payloads, and static assets are deployed at different times, patched code can run alongside old clients. Manage CDN invalidation, function replacement, container rebuilds, and rollback targets as one release unit.",
      ],
      [
        "Leave a security review artifact",
        "Briefly record affected versions, actual usage paths, updated versions, and the URLs and logs you checked. A response is complete only when the next person can act on a future alert, even if the original owner has changed.",
      ],
    ],
    [
      {
        label: "React Server Components security update",
        url: "https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components",
      },
    ],
  ),
  "frontend-issues-2026-vite-8-rolldown": article(
    "2026 Frontend Issue 15 — Vite 8's move to Rolldown and plugin compatibility",
    "How Vite 8's Rolldown transition affects plugin compatibility, build speed, and source maps.",
    "Vite 8 is changing its build approach by making Rolldown the default bundler. The Rust-based tool aims to reduce the gap between development and production builds and shorten build times for larger projects.",
    [
      [
        "A faster build can hide regressions",
        "A new bundler can change plugin hooks, CSS order, dynamic imports, and source maps. Compare more than speed: use route fixtures, asset hashes, and error stack traces alongside existing Vite behavior.",
      ],
      [
        "Define the migration boundary",
        "Check compatible versions of official plugins first, then reproduce issues with internal plugins in a small project. Change the bundler alone at first and keep browser support and framework upgrades separate. That makes failures easier to diagnose and changes easier to revert.",
      ],
    ],
    [
      {
        label: "Vite 8.0 is out!",
        url: "https://vite.dev/blog/announcing-vite8",
      },
    ],
  ),
  "frontend-issues-2026-web-platform-choices": article(
    "2026 Frontend Issue 20 — Bringing Baseline into build settings",
    "How to apply Baseline to Vite and Next.js settings and turn browser support policy into tests.",
    "“Modern browsers” is not a precise requirement. Baseline provides a shared view of how widely web features are supported. Vite uses it in the default build target, and frameworks are making it clearer which browser features a build relies on.",
    [
      [
        "Set policy before code",
        "If you support targets outside the usual browser range, such as an internal WebView, entry-level Android device, or search crawler, define that policy separately. Do not assume “Baseline means it works.” Test supported targets, progressive enhancement, and fallbacks.",
      ],
      [
        "A practice for this year",
        "Manage browser targets in one document instead of scattering them across `package.json` and bundler settings. Record Baseline support and fallback paths for CSS, Web APIs, and JavaScript syntax, then revisit the policy quarterly against actual usage.",
      ],
    ],
    [
      { label: "Interop 2025", url: "https://web.dev/blog/interop-2025" },
      { label: "Vite 7", url: "https://vite.dev/blog/announcing-vite7" },
      { label: "Next.js blog", url: "https://nextjs.org/blog" },
    ],
  ),
  "frontend-typescript-issues-2025-2026-index": article(
    "A reading map for 2025–2026 Frontend and TypeScript issues",
    "A topic-based guide to major changes in frontend development and TypeScript in 2025 and 2026.",
    "This reading map follows where tools run and how they affect rendering, deployment, security, and team workflows. Start with the 2025 entries to understand execution boundaries, then follow the 2026 entries on agents, platforms, and native tooling.",
    [
      [
        "2025: Revisit familiar tools and settings",
        "These articles look beyond which tools to install. They cover the end of Create React App support; Vite 7 and Node.js 24; TypeScript 5.8 and 5.9; React Compiler; and React Server Components security. Read them to see how rendering, deployment, and security boundaries are changing.",
      ],
      [
        "2026: Prepare for agents and platform changes",
        "The 2026 collection covers agent-readable projects, Next.js platform, security, and navigation updates, Vite 8 and Rolldown, React Foundation, Node.js 26, and native TypeScript 6 and 7. It also considers reproducible guidance and rollback plans, not just the pace of feature development.",
      ],
      [
        "A suggested order",
        "Begin with the 2025 CRA, Node.js, and Vite articles to map execution boundaries. Then read TypeScript 5.8 and 5.9 and the native roadmap. Continue with React and RSC security, followed by the 2026 articles on agents and platforms. That sequence helps evaluate new features without relying on version numbers alone.",
      ],
    ],
    [],
    [
      {
        label: "Create React App sunset",
        slug: "frontend-issues-2025-create-react-app-sunset",
      },
      {
        label: "React Compiler 1.0",
        slug: "frontend-issues-2025-react-compiler",
      },
      { label: "React 19.2 Activity", slug: "frontend-issues-2025-react-19-2" },
      { label: "TypeScript 5.8", slug: "typescript-issues-2025-5-8" },
      { label: "TypeScript 5.9", slug: "typescript-issues-2025-5-9" },
      { label: "Vite 7", slug: "frontend-issues-2025-vite-7" },
      { label: "Node.js 24", slug: "frontend-issues-2025-node-24" },
      { label: "Interop 2025", slug: "frontend-issues-2025-interop" },
      {
        label: "Browser-native web UI",
        slug: "frontend-issues-2025-interop-ui",
      },
      {
        label: "ESLint flat config",
        slug: "frontend-issues-2025-eslint-flat-config",
      },
      { label: "RSC security", slug: "frontend-issues-2025-rsc-security" },
      {
        label: "WebAssembly boundaries",
        slug: "frontend-issues-2025-webassembly-boundary",
      },
      {
        label: "Native TypeScript roadmap",
        slug: "typescript-issues-2025-native-roadmap",
      },
      {
        label: "TypeScript 6.0 transition",
        slug: "typescript-issues-2026-6-transition",
      },
      { label: "Native TypeScript 7", slug: "typescript-issues-2026-7-native" },
      { label: "Next.js adapters", slug: "frontend-issues-2026-next-adapters" },
      {
        label: "Agent-ready Next.js",
        slug: "frontend-issues-2026-next-agent-ready",
      },
      {
        label: "Next.js security releases",
        slug: "frontend-issues-2026-next-security",
      },
      {
        label: "Node.js 26 and Temporal",
        slug: "frontend-issues-2026-node-26-temporal",
      },
      {
        label: "Vite 8 and Rolldown",
        slug: "frontend-issues-2026-vite-8-rolldown",
      },
      {
        label: "React Foundation",
        slug: "frontend-issues-2026-react-foundation",
      },
      {
        label: "RSC security follow-up",
        slug: "frontend-issues-2026-rsc-security-followup",
      },
      {
        label: "Agent-first documentation",
        slug: "frontend-issues-2026-agent-first-docs",
      },
      {
        label: "Instant Navigation",
        slug: "frontend-issues-2026-instant-navigation",
      },
      {
        label: "Web platform support",
        slug: "frontend-issues-2026-web-platform-choices",
      },
    ],
  ),
  "typescript-issues-2025-5-8": article(
    "2025 TypeScript Issue 01 — Return expression checks and JSON imports in 5.8",
    "How TypeScript 5.8's return expression checks and import attributes connect to module runtimes.",
    "TypeScript 5.8 checks each branch of a conditional return expression more carefully. In code that returns a cached or newly created value, it can catch branch-specific type errors during compilation.",
    [
      [
        "From `assert` to `with`",
        'Following the module ecosystem, including Node.js, TypeScript supports `with { type: "json" }` import attributes for JSON. The important shift is not only TypeScript syntax: the runtime and tools are moving toward the same standard. Configure `module` and `moduleResolution` together and test in the actual runtime.',
      ],
      [
        "A migration checklist",
        "Start CI checks with complex return expressions, then test JSON imports separately in the bundler and Node.js. Record the package's ESM and CommonJS boundaries along with the type-version upgrade.",
      ],
    ],
    [
      {
        label: "Announcing TypeScript 5.8",
        url: "https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/",
      },
    ],
  ),
  "typescript-issues-2025-5-9": article(
    "2025 TypeScript Issue 02 — A more readable tsconfig in 5.9",
    "How a shorter tsc --init, import defer, and improved hover information change developer workflows.",
    "TypeScript 5.9's `tsc --init` no longer fills a new project with commented-out options. It starts with a concise set of settings that new projects need, making the options a team actually uses easier to find and change.",
    [
      [
        "Deferred loading and editor experience",
        "Support for `import defer` makes module initialization timing more explicit. Adjusting the size of editor hover information makes complex generics easier to read. Productivity depends not only on type-system capabilities but also on how easily developers can inspect types in the editor.",
      ],
      [
        "What to check as a team",
        "Do not copy the new `tsconfig` without comparing it with the current build, test, and editor paths. Because `import defer` changes execution order, update bundler tree-shaking and side-effect tests too.",
      ],
    ],
    [
      {
        label: "Announcing TypeScript 5.9",
        url: "https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/",
      },
    ],
  ),
  "typescript-issues-2025-native-roadmap": article(
    "2025 TypeScript Issue 03 — Preparing for the native TypeScript compiler",
    "What TypeScript's move to Go may mean for type-checker and editor performance.",
    "The TypeScript team has shared its work to move the compiler and language service to native code. The goal is faster type checks and editor responses in large projects, with plugin and API compatibility still to verify.",
    [
      [
        "Porting changes the build contract",
        "Even if the checker gets faster, verify that project references, generated code, declaration output, and IDE plugins produce the same results. Measure the slowest work in your own repository rather than relying only on published performance numbers.",
      ],
      [
        "What to prepare in 2025",
        "Find dependencies on old Compiler APIs and pin `tsc` and editor versions in the lockfile. Test nightly builds or native previews in a separate CI job, with a path back to the existing toolchain if results differ.",
      ],
    ],
    [
      {
        label: "Progress on TypeScript 7",
        url: "https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/",
      },
    ],
  ),
  "typescript-issues-2026-6-transition": article(
    "2026 TypeScript Issue 04 — TypeScript 6.0 is a transition release",
    "Turn TypeScript 6.0 defaults and deprecated options into a checklist for preparing for 7.0.",
    "TypeScript 6.0 maintains compatibility with 5.9 while cleaning up defaults and deprecated options related to `rootDir`, `types`, and module resolution. It helps uncover hidden assumptions in a repository before the next native compiler arrives, rather than requiring every fix at once.",
    [
      [
        "List configuration debt",
        "Search first for deprecated options such as `baseUrl`, `moduleResolution: node10`, and the ES5 target. Scripts that pass filenames directly to `tsc` may fail if they expect it to load `tsconfig` automatically. Make CI commands explicitly use project mode.",
      ],
      [
        "Upgrade incrementally",
        "Split fixes by package instead of suppressing every warning. `ignoreDeprecations` is temporary, not the final configuration. Check declaration output alongside type checking to catch problems for library consumers.",
      ],
    ],
    [
      {
        label: "TypeScript 6.0 release notes",
        url: "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html",
      },
    ],
  ),
  "typescript-issues-2026-7-native": article(
    "2026 TypeScript Issue 05 — Reading TypeScript 7.0's “10× faster” forecast",
    "Compare projected TypeScript 7 performance gains with real team bottlenecks and compatibility needs.",
    "TypeScript 7.0 aims to provide the compiler and language service as native Go-based versions, with a substantial performance improvement over TypeScript 6.0. Shorter type checks in a large monorepo can let a team change code and verify the result more often.",
    [
      [
        "A compatibility matrix matters more than one number",
        "Performance varies with repository size, caching, and incremental builds. Compare the Compiler API, tsserver plugins, generated code, and declaration output in a separate matrix. A faster tool that produces different types is not a safe upgrade.",
      ],
      [
        "Adopt it operationally",
        "Run the native version first in a dedicated CI job and compare it with the existing `tsc`. Even if developers use the new language service in their editors, keep build and release versions reproducible so teams do not get different type-check results.",
      ],
    ],
    [
      {
        label: "Announcing TypeScript 7.0",
        url: "https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/",
      },
    ],
  ),
};

const japanese: Record<string, LocalizedArticle> = {
  "frontend-issues-2025-create-react-app-sunset": article(
    "2025 フロントエンド課題 01 — Create React App の終了から考えること",
    "React チームが新規プロジェクトに Create React App を推奨しなくなった理由と、次のツール選びの基準を整理します。",
    "React チームは2025年2月、新しいアプリケーションでは Create React App を使わないよう案内しました。React の時代が終わったという意味ではありません。画面構成やルーティング、デプロイをフレームワークやビルドツールがより適切に支援できる、という判断です。",
    [
      [
        "ツール名より運用境界で選ぶ",
        "フレームワーク選びでは SSR の有無だけでなく、静的 export が必要か、サーバー関数をどこで実行するか、キャッシュ無効化と可観測性を誰が担うかも整理します。小さなサイトなら Vite と静的ホスティングで十分です。データ、ルーティング、サーバーコンポーネントが必要なら Next.js などが適しています。",
      ],
      [
        "次にすること",
        "既存の CRA アプリをすぐに作り直す前に、ビルド手順を文書化し、テスト、環境変数、デプロイ成果物を確認します。新しいアプリでは「React テンプレート」を選ぶだけでなく、必要なサーバー機能とデプロイ環境から決めるほうが安全です。",
      ],
    ],
    [
      {
        label: "Sunsetting Create React App",
        url: "https://react.dev/blog/2025/02/14/sunsetting-create-react-app",
      },
    ],
  ),
  "frontend-issues-2025-eslint-flat-config": article(
    "2025 フロントエンド課題 07 — ESLint flat config 移行時の確認事項",
    "ESLint 設定を flat config に移し、eslintrc サポート終了に備える手順をまとめます。",
    "flat config は配列と `defineConfig` を使い、ファイルパターンごとにルールを組み合わせます。`.eslintrc` の継承や ignore ルールに慣れたチームは、構文を移すだけでなく、各ファイルに適用されるルールも確認して文書化しましょう。",
    [
      [
        "TypeScript モノレポでの進め方",
        "各パッケージの `eslint.config.*` と共通 preset の役割を分けます。次に TypeScript parser、React ルール、テスト環境の global 変数をファイルパターンに合わせます。最後に CI でルートと各パッケージの結果を比較します。",
      ],
      [
        "v10 を待たずに契約を決める",
        "ESLint 10 では eslintrc ファイルと関連する CLI オプションが削除される予定です。早めに移すことでルールの漏れを見つけ、独自 plugin が廃止予定 API に依存していないか確認できます。",
      ],
    ],
    [
      {
        label: "Evolving flat config",
        url: "https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/",
      },
      {
        label: "What's coming in ESLint v10",
        url: "https://eslint.org/blog/2025/10/whats-coming-in-eslint-10.0.0/",
      },
    ],
  ),
  "frontend-issues-2025-interop-ui": article(
    "2025 フロントエンド課題 10 — ブラウザー標準 UI がデザインシステムを変える",
    "Popover、カスタマイズ可能な select、anchor positioning でデザインシステムの JavaScript 依存を減らす方法を紹介します。",
    "select、popover、アンカーメニューはよく使われますが、フォーカス移動、閉じる動作、画面端の処理を自前で実装する必要がありました。2025年には複数のブラウザーで Popover API と anchor positioning が安定して使えるようになりました。",
    [
      [
        "責務を適切な層に移す",
        "ブラウザーが標準動作を提供すれば、デザインシステムは色、余白、動き、製品固有のルールに集中できます。ただし、ネイティブ API を包むコンポーネントがアクセシブルな名前とキーボード操作を保つかは別途確認が必要です。",
      ],
      [
        "段階的に採用する",
        "対象ブラウザーの Baseline 対応状況を確認し、既存 polyfill と機能が重複しないか調べます。まずメニューひとつをネイティブ API に移し、キーボード、スクリーンリーダー、モバイルで比較してから全体へ広げます。",
      ],
    ],
    [
      {
        label: "What's New in Web UI: I/O 2025",
        url: "https://developer.chrome.com/blog/new-in-web-ui-io-2025-recap",
      },
    ],
  ),
  "frontend-issues-2025-interop": article(
    "2025 フロントエンド課題 06 — Interop 2025 が変えたブラウザー選び",
    "anchor positioning、画面遷移、Navigation API をブラウザー横断で検証する機能として見ていきます。",
    "Interop 2025 では anchor positioning、View Transition API、Navigation API、`@scope`、WebAssembly などが、ブラウザーベンダー共通の検証項目になりました。機能一覧を増やすだけでなく、共通の基準で対応状況を確認できる点が重要です。",
    [
      [
        "ライブラリの役割が変わる",
        "Popover や anchor positioning のように、ブラウザーが位置、フォーカス、閉じる動作を担う機能が安定すれば、UI ライブラリはスタイルと製品パターンに集中できます。ただしアクセシビリティ検証は引き続き必要です。ネイティブ動作と実際のユーザーフローを確認しましょう。",
      ],
      [
        "Baseline をチームの共通語にする",
        "対応ブラウザーを曖昧に「モダン」と呼ぶのではなく、Baseline の状態と社内利用率を合わせて記録します。段階的拡張ができる機能は通常経路に置き、まだ安定していないものは実験経路で検証します。",
      ],
    ],
    [{ label: "Interop 2025", url: "https://web.dev/blog/interop-2025" }],
  ),
  "frontend-issues-2025-node-24": article(
    "2025 フロントエンド課題 05 — Node.js 24 がフロントエンドツールに与える影響",
    "Node.js 24 のランタイム変更が開発サーバーやテストツールに与える影響を確認します。",
    "Node.js 24 には V8 13.6 と npm 11 が含まれます。`URLPattern` が global で使えるようになり、`AsyncLocalStorage` の既定実装も変わりました。ブラウザーコード中心のチームも、開発サーバー、テスト、事前レンダリングが必要とする Node.js のバージョンを確認しましょう。",
    [
      [
        "非同期コンテキストの意味",
        "AsyncContextFrame は、リクエスト追跡やログ記録のように非同期処理間で文脈を渡す機能に影響します。フレームワークの対応を確認しないと、ローカルと CI の結果が異なる可能性があります。",
      ],
      [
        "LTS 前に確認すること",
        "Current をすぐ本番に適用せず、まず CI に追加して互換性を確認します。package manager、native module、Playwright のブラウザーバージョンも合わせて管理し、10月の LTS 移行前に採用を判断し直します。",
      ],
    ],
    [
      {
        label: "Node.js 24.0.0",
        url: "https://nodejs.org/en/blog/release/v24.0.0",
      },
    ],
  ),
  "frontend-issues-2025-react-19-2": article(
    "2025 フロントエンド課題 03 — React 19.2 の Activity と画面のライフサイクル",
    "Activity、useEffectEvent、Performance Tracks が画面状態の保持と作業計測にどう役立つかを紹介します。",
    "React 19.2 の `<Activity />` は、画面を完全に削除せず非表示にし、その画面の作業優先度を下げられます。タブや入力途中のフォームなど、再び戻る画面の状態を保つ方法が増えました。",
    [
      [
        "Effect の実行時点と性能記録が明確に",
        "`useEffectEvent` を使うと、ユーザーイベントに応じる処理とレンダリングに反応する effect を分けやすくなります。Performance Tracks はブラウザーの性能記録で React の処理を確認しやすくします。どちらも最適化の前に、各処理の実行タイミングを把握する助けになります。",
      ],
      [
        "採用前に考えること",
        "Activity を導入する前に、非表示画面がメモリやアクセシビリティに与える影響を確認します。effect を変更する前に、外部システムとの同期なのかユーザー操作なのか分類します。新 API は、構文の新しさではなく状態保持や計測の改善で評価しましょう。",
      ],
    ],
    [
      {
        label: "React 19.2",
        url: "https://react.dev/blog/2025/10/01/react-19-2",
      },
    ],
  ),
  "frontend-issues-2025-react-compiler": article(
    "2025 フロントエンド課題 02 — React Compiler 導入後も残るコスト",
    "React Compiler が memoization を自動化しても、性能計測とコンポーネント設計が重要な理由を解説します。",
    "React Compiler 1.0 が安定版になりました。コンポーネントと hook を解析し、必要な memoization を自動適用します。開発者は `useMemo` や `useCallback` を習慣で追加せず、意図が明確な描画コードを書けます。",
    [
      [
        "自動化が設計を代替するわけではない",
        "compiler は高コストな計算、過剰な global state、ネットワーク境界、誤った key を解決しません。導入前後の操作遅延と描画回数を同じシナリオで測定し、compiler が処理を見送った場合は理由を記録します。",
      ],
      [
        "安全な導入手順",
        "まず lint と compiler の設定を CI に加え、小さな画面から選択的に適用します。性能が悪化したら手動 memoization を増やす前に、コンポーネントの役割とデータの流れを見直します。自動最適化はコード量ではなく、測定可能なユーザー体験で評価します。",
      ],
    ],
    [
      {
        label: "React Compiler v1.0",
        url: "https://react.dev/blog/2025/10/07/react-compiler-1",
      },
    ],
  ),
  "frontend-issues-2025-rsc-security": article(
    "2025 フロントエンド課題 08 — React Server Components のセキュリティ修正から学ぶ",
    "RSC の脆弱性が、framework 更新、SBOM、デプロイ検証をひとつの作業に結び付けた経緯を記録します。",
    "2025年12月に公表された React Server Components の脆弱性は、サーバーとブラウザー間でデータをやり取りする serialization protocol も攻撃対象になることを示しました。「フロントエンド依存関係」とだけ分類すると、サーバーランタイムのリスクを見落とすことがあります。",
    [
      [
        "修正 PR は始まりにすぎない",
        "package 更新後、lockfile、build 成果物、稼働中サーバーが同じバージョンか確認します。脆弱な経路を実際に使うかどうかにかかわらず、公式修正版へ上げ、cache に残る image と function も置き換えます。",
      ],
      [
        "次のインシデントを減らす",
        "SBOM と dependency review を CI に加え、セキュリティリリース通知を通常の機能変更と分けます。RSC、server action、serialization 境界を使うアプリは、client test だけでなく server のエラー処理と権限確認も回帰テストに含めます。",
      ],
    ],
    [
      {
        label: "Critical Security Vulnerability in React Server Components",
        url: "https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components",
      },
    ],
  ),
  "frontend-issues-2025-vite-7": article(
    "2025 フロントエンド課題 04 — Vite 7 と ESM 移行の現実",
    "Vite 7 の Node.js 要件、ESM 移行、Baseline ブラウザー設定に向けた準備を整理します。",
    "Vite 7 は Node.js 20.19 以上または 22.12 以上を要求し、Node.js 18 のサポートを終了しました。ESM 専用として配布され、Node.js の `require(esm)` 対応を利用します。build tool の更新時は開発環境と CI の Node.js バージョンも確認しましょう。",
    [
      [
        "Baseline Widely Available が既定に",
        "既定のブラウザー対象は `modules` から `baseline-widely-available` に変わりました。Baseline を使うと、どの程度古いブラウザーまで支援するかを共通基準で決められます。ただし社内 embedded browser や WebView をサポートするなら、既定値が要件に合うか確認します。",
      ],
      [
        "更新前に試す",
        "最初に Node.js バージョンを決め、CommonJS plugin、Vitest、SSR adapter をまとめてテストします。ブラウザー対象を変えた後は bundle サイズと対象ブラウザーでの動作を比較します。ESM 移行はひとつの設定ではなく、toolchain 全体に影響します。",
      ],
    ],
    [
      {
        label: "Vite 7.0 is out!",
        url: "https://vite.dev/blog/announcing-vite7",
      },
    ],
  ),
  "frontend-issues-2025-webassembly-boundary": article(
    "2025 フロントエンド課題 09 — WebAssembly でサーバーフレームワークをブラウザー実行する",
    "WebAssembly をブラウザーで動かす利点と、性能や cache で考慮すべき点を紹介します。",
    "WebAssembly でサーバーフレームワークをブラウザー上で動かす事例は、アプリの一部をユーザー端末で実行できる可能性を示します。通信往復を減らして offline でも使えますが、大きな binary、メモリ使用量、初期化時間というコストがあります。",
    [
      [
        "フロントエンドチームが担う境界",
        "Wasm module に渡す入力データと権限を明確にし、JavaScript とデータを交換する serialization コストも測定します。cache された module が古い code を実行しないようバージョンを分け、失敗時は server で処理する経路を用意します。",
      ],
      [
        "小さな実験から始める",
        "文書変換、検索、画像処理のように計算範囲が明確なタスクを選びます。backend 全体をブラウザーに移すより、ユーザーの利点が大きい作業ひとつを試すほうが効果を検証しやすくなります。",
      ],
    ],
    [
      {
        label: "Ruby on Rails on WebAssembly",
        url: "https://web.dev/blog/ruby-on-rails-on-webassembly",
      },
    ],
  ),
  "frontend-issues-2026-agent-first-docs": article(
    "2026 フロントエンド課題 18 — ドキュメントはエージェントがプロジェクトを理解する入口",
    "AGENTS.md と Markdown ドキュメントの endpoint が、人とエージェントの framework 利用をどう変えるかを紹介します。",
    "バージョンに合った `AGENTS.md`、Markdown ドキュメント、解決方法を示すエラーメッセージは、エージェントが古い記事や推測に頼るのを防ぎます。エージェントが framework を使うようになれば、文書を見つけやすく保つことも製品品質の一部です。",
    [
      [
        "人にも同じ利点がある",
        "エージェントが読める文書は、人も必要な内容を素早く見つけて検証する助けになります。command の前提条件、変更される file、失敗時の対応を短く書けば、新メンバーの立ち上がりと障害対応の両方に役立ちます。",
      ],
      [
        "repository に取り入れる",
        "共通原則は repository root に置き、app や package 固有のバージョンと command は各場所で管理します。secret と個人環境設定は記載しません。CI で文書中の command を実行し、説明と実際の動作がずれていないか確認します。",
      ],
    ],
    [
      {
        label: "Next.js 16.3 AI Improvements",
        url: "https://nextjs.org/blog/next-16-3-ai-improvements",
      },
    ],
  ),
  "frontend-issues-2026-instant-navigation": article(
    "2026 フロントエンド課題 19 — Next.js Instant Navigation の cache 設計",
    "Next.js 16.3 の高速画面遷移と一部データの先読みが、server と client の cache に与える影響を見ます。",
    "Next.js 16.3 は画面遷移を速く見せるため Stream、Cache、Block を選ぶ仕組みと、一部データを先読みする機能を紹介しました。ユーザーは SPA のように移動でき、開発者は共通 UI を再利用するか、データを再取得するかを決めます。",
    [
      [
        "cache の範囲もセキュリティ基準",
        "ユーザー別データや権限が必要な画面まで広く cache すると問題が起きる可能性があります。逆にすべてを Block にすると新機能の利点がなくなります。route、cookie、cache tag、再検証時間をまとめて管理します。",
      ],
      [
        "検証する指標",
        "同じ account で初回と再訪時の TTFB、INP、データの新しさを比較します。戻る操作や遅いモバイル回線で古い画面が現れないか確認し、cache 更新の失敗を log で追えるようにします。",
      ],
    ],
    [
      {
        label: "Next.js 16.3 Instant Navigations",
        url: "https://nextjs.org/blog/next-16-3-instant-navigations",
      },
    ],
  ),
  "frontend-issues-2026-next-adapters": article(
    "2026 フロントエンド課題 11 — Next.js Adapter API と platform ごとのデプロイ",
    "Adapter API により、デプロイ時の framework と cloud platform の役割がどう変わるかを紹介します。",
    "Next.js 16.2 で Adapter API が安定しました。route、事前レンダリング結果、静的 asset、実行環境、cache ルールをバージョン付き形式で platform に伝えられ、hosting 側が framework の内部動作を推測する必要が減ります。",
    [
      [
        "platform 独立には実際のコストがある",
        "Adapter があっても、すべてのデプロイが同じにはなりません。streaming、image、cache 無効化、function 実行時間は platform ごとに異なります。デプロイ前に adapter の出力と実際の response header、cache 動作を比較する contract test が必要です。",
      ],
      [
        "チームでの適用順",
        "まず静的 route と server route を分け、各デプロイが使う platform 機能を記録します。次に同じ test fixture を複数 adapter で build し、routing と cache を比べます。抽象化は差を隠すのではなく、確認できるようにするものです。",
      ],
    ],
    [
      {
        label: "Next.js Across Platforms",
        url: "https://nextjs.org/blog/nextjs-across-platforms",
      },
    ],
  ),
  "frontend-issues-2026-next-agent-ready": article(
    "2026 フロントエンド課題 12 — エージェントが読んで修正できる Next.js プロジェクト",
    "AGENTS.md、ブラウザーログ、MCP で Next.js の開発環境をエージェントに役立てる方法を紹介します。",
    "Next.js は project の version に合わせた `AGENTS.md` を提供し、browser log を terminal に渡せるようにしました。React state を調べる browser tool と MCP も実験中です。コードを変える前に framework のルールと実行中の error を確認しやすくします。",
    [
      [
        "「直して」を再現可能な入力にする",
        "URL、log、component state、再現手順を一定の形式で渡すと、copy した browser error より検証しやすくなります。log に token や個人情報が含まれると、開発支援機能が新たな漏えい経路になる可能性もあります。",
      ],
      [
        "project に必要な境界を決める",
        "repository の指示、実行する検証 command、変更してはいけない file、secret の扱いを先に書きます。エージェントの権限を read、write、deploy に分け、最後の merge は人が承認するようにします。",
      ],
    ],
    [
      {
        label: "Building Next.js for an agentic future",
        url: "https://nextjs.org/blog/agentic-future",
      },
      {
        label: "Next.js 16.2 AI improvements",
        url: "https://nextjs.org/blog/next-16-2-ai",
      },
    ],
  ),
  "frontend-issues-2026-next-security": article(
    "2026 フロントエンド課題 13 — 定期的な Next.js セキュリティ修正に備える",
    "Next.js のセキュリティ修正を適用し、実際のデプロイ環境まで確認する手順を紹介します。",
    "Next.js は2026年から、セキュリティ修正と事前告知をより定期的に提供する手順を紹介しました。運用チームは機能リリースだけを待つのではなく、サポート中のバージョン系列を継続的に確認する必要があります。",
    [
      [
        "version 番号だけでなく成果物を確認する",
        "`package.json` の version を上げるだけでは足りません。lockfile、Docker image、Lambda bundle、CDN cache、source map が同じ修正 version を指すかを確認します。実際の URL に request を送り、header、RSC response、静的 asset を smoke test します。",
      ],
      [
        "小さく自動化する",
        "Dependabot や Renovate の変更に security label を付け、test 後に所定の承認手順で deploy します。問題時に前の build に戻せるよう、deploy 成果物と database migration を分けて管理します。",
      ],
    ],
    [
      {
        label: "July 2026 Security Release",
        url: "https://nextjs.org/blog/july-2026-security-release",
      },
    ],
  ),
  "frontend-issues-2026-node-26-temporal": article(
    "2026 フロントエンド課題 14 — Temporal で日付と time zone を扱う",
    "Temporal の標準搭載を受け、frontend、SSR、データ serialization の Date 処理を見直します。",
    "Node.js 26 では Temporal API を追加設定なしで使えます。`Date` で曖昧だった time zone、calendar、値の変更を扱う標準 API が server runtime に入りました。",
    [
      [
        "SSR と browser の結果をそろえる",
        "server で `Temporal.ZonedDateTime` を使う場合も、JSON に渡す形式を明示します。browser の対応状況、polyfill の容量、画面に表示する time zone を決めましょう。server だけで新 API を使うと hydration の結果が異なる可能性があります。",
      ],
      [
        "導入チェックリスト",
        "まず会計や予約のように time zone が重要な機能で、日付をどう扱うか決めます。API では UTC の時刻と画面表示用の time zone を分けます。既存 `Date` を一括置換せず、新しい module から Temporal を使い serialization test を追加します。",
      ],
    ],
    [
      {
        label: "Node.js 26.0.0",
        url: "https://nodejs.org/en/blog/release/v26.0.0",
      },
    ],
  ),
  "frontend-issues-2026-react-foundation": article(
    "2026 フロントエンド課題 16 — React Foundation と ecosystem の運営",
    "React Foundation の始動を受け、ecosystem の意思決定や長期互換性をどう見るか整理します。",
    "React Foundation は Linux Foundation のもとで React と関連 project を継続的に管理する体制づくりです。製品チームも license、release、互換性を誰がどの手順で決めるか確認する必要があります。",
    [
      [
        "企業依存から ecosystem の合意へ",
        "ひとつの会社の roadmap を見ていたチームは、maintainer、RFC 手順、主要 partner の役割も確認できます。すべての選択を見直す必要はありません。ただし内部 component が実験機能に依存しないよう、公開 API と upgrade 境界を保ちます。",
      ],
      [
        "portfolio に残す問い",
        "技術選定では「誰が作ったか」だけでなく、「誰が検証し続け、互換性の問題が起きたらどう対応するか」も記録します。governance は将来を保証しませんが、変化の背景と対応手順を確認する助けになります。",
      ],
    ],
    [
      {
        label: "Introducing the React Foundation",
        url: "https://react.dev/blog/2025/10/07/introducing-the-react-foundation",
      },
    ],
  ),
  "frontend-issues-2026-rsc-security-followup": article(
    "2026 フロントエンド課題 17 — RSC の追加脆弱性、修正完了を確かめる",
    "React Server Components の DoS と source exposure に対応した後に確認する運用手順を整理します。",
    "2025年12月の RSC 脆弱性対応後も、DoS と source code exposure の追加告知が続きました。脆弱性対応は一度の `npm install` ではなく、影響範囲と修正の完全性を継続的に確認する作業です。",
    [
      [
        "古い cache が対応を遅らせることがある",
        "server function、RSC payload、静的 asset が別の時点で deploy されると、修正済み code と古い client が同時に動くことがあります。CDN の cache 削除、function 交換、container rebuild、rollback 対象をひとつの release 単位で管理します。",
      ],
      [
        "セキュリティ振り返りの成果物",
        "影響した version、実際の利用経路、更新後の version、確認した URL と log を短く記録します。担当者が変わった後も次の alert に対応できて初めて、脆弱性対応を完了したと言えます。",
      ],
    ],
    [
      {
        label: "React Server Components security update",
        url: "https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components",
      },
    ],
  ),
  "frontend-issues-2026-vite-8-rolldown": article(
    "2026 フロントエンド課題 15 — Vite 8 の Rolldown 移行と plugin 互換性",
    "Vite 8 の Rolldown 移行が plugin 互換性、build 速度、source map に与える影響を整理します。",
    "Vite 8 は Rolldown を既定 bundler にして build の仕組みを変えています。Rust 製 tool によって開発用と本番用 build の差を減らし、大規模 project の build 時間を短縮する狙いです。",
    [
      [
        "速い build が regression を隠すこともある",
        "bundler の変更で plugin hook、CSS 順序、dynamic import、source map が変わる可能性があります。速度だけでなく、route ごとの test fixture、asset hash、error stack trace も従来 Vite と比較します。",
      ],
      [
        "migration の境界を決める",
        "まず公式 plugin の互換 version を確認し、社内 plugin は小さな project で問題を再現します。最初の変更では bundler だけを切り替え、browser support と framework upgrade は分けます。原因の特定と変更の巻き戻しが容易になります。",
      ],
    ],
    [
      {
        label: "Vite 8.0 is out!",
        url: "https://vite.dev/blog/announcing-vite8",
      },
    ],
  ),
  "frontend-issues-2026-web-platform-choices": article(
    "2026 フロントエンド課題 20 — Baseline を build 設定に反映する",
    "Baseline を Vite と Next.js の設定に反映し、browser support policy と test に結び付けます。",
    "「モダンブラウザー」だけでは要件が曖昧です。Baseline は主要ブラウザーにおける web 機能の対応状況を共通基準で示します。Vite は既定の build target に取り入れ、framework も成果物が依存する機能を明確にしつつあります。",
    [
      [
        "policy は code より先に決める",
        "社内 WebView、普及価格帯の Android、検索 crawler など一般的な browser 範囲外の対象も支援するなら、別の policy が必要です。「Baseline だから動く」と仮定せず、対象、段階的拡張、代替経路を test 項目にします。",
      ],
      [
        "今年取り組むこと",
        "browser target を `package.json` や bundler 設定に分散させず、一つの文書で管理します。CSS、Web API、JavaScript 構文ごとに Baseline と fallback を記録し、四半期ごとに実際の利用率を見て更新します。",
      ],
    ],
    [
      { label: "Interop 2025", url: "https://web.dev/blog/interop-2025" },
      { label: "Vite 7", url: "https://vite.dev/blog/announcing-vite7" },
      { label: "Next.js blog", url: "https://nextjs.org/blog" },
    ],
  ),
  "frontend-typescript-issues-2025-2026-index": article(
    "2025–2026 フロントエンド・TypeScript 課題の読み方ガイド",
    "2025年と2026年のフロントエンドおよび TypeScript の主な変化をテーマ別に紹介します。",
    "このガイドでは、tool がどこで動き、描画、deploy、security、チームの進め方にどう影響するかを追います。まず2025年の記事で実行境界をつかみ、次に agent、platform、native toolchain に関する2026年の記事を読んでください。",
    [
      [
        "2025年：使い慣れた tool と設定を見直す",
        "各記事は、何を導入するかだけでなく、tool がどこでどう実行されるかを扱います。Create React App の終了、Vite 7 と Node.js 24、TypeScript 5.8・5.9、React Compiler、React Server Components の security を読み、描画、deploy、security がどう変わるか確認できます。",
      ],
      [
        "2026年：agent と platform の変化に備える",
        "agent が読み書きしやすい project、Next.js の platform・security・navigation 機能、Vite 8 と Rolldown、React Foundation、Node.js 26、TypeScript 6・7 の native 移行を扱います。機能開発の速さだけでなく、手順の再現性と rollback も大切です。",
      ],
      [
        "おすすめの読む順序",
        "最初に CRA、Node.js、Vite の記事で実行境界を整理し、TypeScript 5.8・5.9 と native roadmap で言語 tool の方向を確認します。その後 React と RSC security、2026年の agent・platform 記事へ進むと、version 番号だけで新機能の採用を決めない基準を作れます。",
      ],
    ],
    [],
    [
      {
        label: "Create React App の終了",
        slug: "frontend-issues-2025-create-react-app-sunset",
      },
      {
        label: "React Compiler 1.0",
        slug: "frontend-issues-2025-react-compiler",
      },
      { label: "React 19.2 Activity", slug: "frontend-issues-2025-react-19-2" },
      { label: "TypeScript 5.8", slug: "typescript-issues-2025-5-8" },
      { label: "TypeScript 5.9", slug: "typescript-issues-2025-5-9" },
      { label: "Vite 7", slug: "frontend-issues-2025-vite-7" },
      { label: "Node.js 24", slug: "frontend-issues-2025-node-24" },
      { label: "Interop 2025", slug: "frontend-issues-2025-interop" },
      {
        label: "ブラウザー標準 Web UI",
        slug: "frontend-issues-2025-interop-ui",
      },
      {
        label: "ESLint flat config",
        slug: "frontend-issues-2025-eslint-flat-config",
      },
      { label: "RSC security", slug: "frontend-issues-2025-rsc-security" },
      {
        label: "WebAssembly の境界",
        slug: "frontend-issues-2025-webassembly-boundary",
      },
      {
        label: "TypeScript native roadmap",
        slug: "typescript-issues-2025-native-roadmap",
      },
      {
        label: "TypeScript 6.0 の移行",
        slug: "typescript-issues-2026-6-transition",
      },
      { label: "TypeScript 7 native", slug: "typescript-issues-2026-7-native" },
      { label: "Next.js adapters", slug: "frontend-issues-2026-next-adapters" },
      {
        label: "agent 対応 Next.js",
        slug: "frontend-issues-2026-next-agent-ready",
      },
      {
        label: "Next.js security release",
        slug: "frontend-issues-2026-next-security",
      },
      {
        label: "Node.js 26 と Temporal",
        slug: "frontend-issues-2026-node-26-temporal",
      },
      {
        label: "Vite 8 と Rolldown",
        slug: "frontend-issues-2026-vite-8-rolldown",
      },
      {
        label: "React Foundation",
        slug: "frontend-issues-2026-react-foundation",
      },
      {
        label: "RSC security の続報",
        slug: "frontend-issues-2026-rsc-security-followup",
      },
      {
        label: "agent 向けドキュメント",
        slug: "frontend-issues-2026-agent-first-docs",
      },
      {
        label: "Instant Navigation",
        slug: "frontend-issues-2026-instant-navigation",
      },
      {
        label: "web platform の選択",
        slug: "frontend-issues-2026-web-platform-choices",
      },
    ],
    "各記事の紹介と、おすすめの読む順序はこちらです",
  ),
  "typescript-issues-2025-5-8": article(
    "2025 TypeScript 課題 01 — 5.8 の戻り値検査と JSON import",
    "TypeScript 5.8 の戻り値検査と import attributes を module runtime と結び付けて解説します。",
    "TypeScript 5.8 は conditional return expression の各分岐をより厳密に確認します。cache 済みの値または新しい値を返す code で、分岐ごとの type error を compile 時に見つけやすくなります。",
    [
      [
        "`assert` から `with` へ",
        'Node.js を含む module ecosystem が import attributes を導入する流れを受け、JSON import の `with { type: "json" }` 構文をサポートしました。TypeScript の構文だけでなく runtime と tool が同じ標準に向かう変化です。`module` と `moduleResolution` を合わせて設定し、実際の runtime で確かめます。',
      ],
      [
        "migration checklist",
        "複雑な return expression から新 compiler の CI 検査を始め、JSON import は bundler と Node.js の両方で確認します。type version だけでなく package の ESM・CJS 境界も記録しましょう。",
      ],
    ],
    [
      {
        label: "Announcing TypeScript 5.8",
        url: "https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/",
      },
    ],
  ),
  "typescript-issues-2025-5-9": article(
    "2025 TypeScript 課題 02 — 5.9 で読みやすくなった tsconfig",
    "簡潔になった tsc --init、import defer、hover 情報の改善が開発環境に与える変化を紹介します。",
    "TypeScript 5.9 の `tsc --init` は、以前のように利用可能な option を長い comment で並べず、新しい project に必要な設定を簡潔に示します。チームが実際に使う option を見つけ、編集しやすくなりました。",
    [
      [
        "遅延読み込みと editor 体験",
        "`import defer` により module を初期化する時点がより明確になります。editor の hover 表示サイズを調整すると複雑な generic も読みやすくなります。type system の機能だけでなく、editor で type を確認しやすいかも生産性に影響します。",
      ],
      [
        "チームで確認すること",
        "新しい `tsconfig` をそのままコピーせず、現在の build、test、editor の経路と比べます。`import defer` は実行順を変えるため、bundler の tree shaking と side effect test も更新します。",
      ],
    ],
    [
      {
        label: "Announcing TypeScript 5.9",
        url: "https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/",
      },
    ],
  ),
  "typescript-issues-2025-native-roadmap": article(
    "2025 TypeScript 課題 03 — TypeScript native compiler への準備",
    "Go ベースへの移行が type checker と editor の性能に与える影響を考えます。",
    "TypeScript チームは compiler と language service を native code に移す作業を公開しました。大規模 project の type check と editor 応答を速くすることが狙いですが、plugin と API の互換性も確認が必要です。",
    [
      [
        "porting は build の契約を揺るがす",
        "checker が速くなっても、project reference、生成 code、declaration 出力、IDE plugin の結果が従来と同じか確認します。公表された性能値だけでなく、自分の repository で遅い作業を測定します。",
      ],
      [
        "2025年に準備すること",
        "古い Compiler API への依存を探し、`tsc` と editor version を lockfile に記録します。native preview は別の CI job で試し、結果が異なる場合に既存 toolchain に戻せるようにします。",
      ],
    ],
    [
      {
        label: "Progress on TypeScript 7",
        url: "https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/",
      },
    ],
  ),
  "typescript-issues-2026-6-transition": article(
    "2026 TypeScript 課題 04 — TypeScript 6.0 は移行のための release",
    "TypeScript 6.0 の既定値と deprecated option を 7.0 に備える checklist に変えます。",
    "TypeScript 6.0 は 5.9 との互換性を保ちつつ、`rootDir`、`types`、module 解決に関する既定値と deprecated option を整理しました。すべてを今すぐ修正させるのではなく、次の native compiler を前に repository の隠れた前提を見つける release です。",
    [
      [
        "設定負債を一覧にする",
        "まず `baseUrl`、`moduleResolution: node10`、ES5 target のような deprecated option を検索します。file 名を直接 `tsc` に渡しながら `tsconfig` も自動で読むと期待する script は失敗することがあります。CI command を明示的な project mode に変更します。",
      ],
      [
        "段階的に upgrade する",
        "警告をすべて無効にせず、package ごとに修正を分けます。`ignoreDeprecations` は一時対応であり最終設定ではありません。library の利用側に影響がないか、type check と declaration 出力も確認します。",
      ],
    ],
    [
      {
        label: "TypeScript 6.0 release notes",
        url: "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html",
      },
    ],
  ),
  "typescript-issues-2026-7-native": article(
    "2026 TypeScript 課題 05 — TypeScript 7.0 の「10倍高速」をどう読むか",
    "Go ベースの TypeScript 7.0 の性能見通しを、実際の team bottleneck と互換性の課題に照らします。",
    "TypeScript 7.0 は compiler と language service を Go ベースの native 版で提供し、TypeScript 6.0 から大幅な性能向上を目指します。大きな monorepo で type check が短くなれば、変更後に結果を確認する回数を増やせます。",
    [
      [
        "数字より互換性 matrix",
        "性能値は repository の大きさ、cache、incremental build で変わります。Compiler API、tsserver plugin、生成 code、declaration 出力が同じか別の matrix で比較しましょう。速くても異なる type 結果になる tool は安全な upgrade ではありません。",
      ],
      [
        "運用できる形で導入する",
        "native 版は専用 CI で先に実行し、従来の `tsc` と結果を比べます。editor で新しい language service を使う場合も、build と release version は再現可能に管理し、team ごとに type check の結果が変わらないようにします。",
      ],
    ],
    [
      {
        label: "Announcing TypeScript 7.0",
        url: "https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/",
      },
    ],
  ),
};

export const archiveTranslations = { en: english, ja: japanese } as const;
