import type { Locale } from "~/lib/i18n";
import type { PostSummary } from "~/lib/posts";

type LocalizedArticle = {
  sources?: Array<{ label: string; url: string }>;
  excerpt: string;
  intro: string;
  links?: Array<{ label: string; slug: string }>;
  sections: Array<{ heading: string; paragraphs: string[] }>;
  title: string;
};

function editorialArticle(
  title: string,
  excerpt: string,
  intro: string,
  heading: string,
  paragraphs: string[],
  links?: Array<{ label: string; slug: string }>,
): LocalizedArticle {
  return {
    title,
    excerpt,
    intro,
    ...(links ? { links } : {}),
    sections: [{ heading, paragraphs }],
  };
}

const english: Record<string, LocalizedArticle> = {
  "special-it-2026-09-13-agent-permissions": {
    title: "Before handing an agent the keys",
    excerpt:
      "Design permission, approval, and retry boundaries before connecting more tools.",
    intro:
      "Special issue, September 13, 2026. An agent that can summarize a document and one that can publish it need different execution boundaries. This article proposes a practical way to make those boundaries visible.",
    sections: [
      {
        heading: "A connection is not an approval",
        paragraphs: [
          "MCP security guidance prohibits token passthrough, and its HTTP authorization specification separates client and resource-server roles. Do not merge credential boundaries merely to simplify integration.",
          "Our design recommendation is to distinguish reading, drafting, and external changes. A successful connection should not silently turn permission to search into permission to modify.",
        ],
      },
      {
        heading: "Bind consent to an actual change",
        paragraphs: [
          "Consider an assistant extracting tasks from meeting notes. Suggesting an owner differs from creating a task in a shared project. Show the project, proposed tasks, assignees, and disclosed content before execution. Materially changed proposals require a fresh decision.",
          "A missing response does not prove that execution failed. Record an operation identifier and make repeated requests safe against duplication. The service exposing the tool must supply this behavior; protocol adoption alone does not.",
        ],
      },
      {
        heading: "Test the boundary, not just the happy path",
        paragraphs: [
          "Try a write with a read-only account, change the destination after approval, and repeat a request whose response was lost. Expect a refusal, renewed confirmation, and one resulting operation respectively. Log the actor and outcome rather than secret tokens.",
          "Useful autonomy pauses where the consequence changes. Within an approved scope it should proceed predictably. Define those stopping points before increasing the number of connected tools.",
        ],
      },
    ],
    sources: [
      {
        label: "MCP Security Best Practices",
        url: "https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices",
      },
      {
        label: "MCP Authorization",
        url: "https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization",
      },
    ],
    links: [
      {
        label: "Browser AI starts with the download screen",
        slug: "special-it-2026-09-13-browser-ai",
      },
      {
        label: "Passkeys need a life after sign-in",
        slug: "special-it-2026-09-13-passkey-recovery",
      },
      {
        label: "How durable is an offline record?",
        slug: "special-it-2026-09-13-local-first-data",
      },
      {
        label: "Build interfaces that answer a tap",
        slug: "special-it-2026-09-13-inp-interaction",
      },
    ],
  },
  "special-it-2026-09-13-browser-ai": {
    title: "Browser AI starts with the download screen",
    excerpt:
      "Treat readiness, device support, and cloud fallback as product states.",
    intro:
      "Special issue, September 13, 2026. Before evaluating a local model’s answer, users need to know whether the feature works on their device and what they are waiting for.",
    sections: [
      {
        heading: "Present readiness explicitly",
        paragraphs: [
          "Chrome documents model, language, and device requirements as well as availability checks. An API being present does not establish that a session is ready. Some environments require a download; others are unsupported.",
          "Design separate ready, preparing, and unavailable states. A single spinner hides whether waiting can succeed. Verify current support in the relevant API documentation before release.",
        ],
      },
      {
        heading: "Preserve the user’s choice",
        paragraphs: [
          "In a personal notes app, explain a required download when summarization is requested. Keep ordinary reading and editing available while the model is preparing.",
          "Our recommendation is not to send a note to a cloud service automatically when local processing fails. Explain the destination and content, and offer a separate choice. Local processing and remote transmission create different expectations.",
        ],
      },
      {
        heading: "Measure more than inference time",
        paragraphs: [
          "Compare first use, a prepared model, and insufficient storage. Measure time to a useful result and confirm that cancellation preserves the original document. One powerful development machine is not a representative sample.",
          "The product should remain usable without AI. If a failed summary prevents access to the original note, an optional feature has become a dependency of the entire experience.",
        ],
      },
    ],
    sources: [
      {
        label: "Chrome: Built-in AI",
        url: "https://developer.chrome.com/docs/ai/built-in",
      },
      {
        label: "Chrome: Get started with built-in AI",
        url: "https://developer.chrome.com/docs/ai/get-started",
      },
    ],
    links: [
      {
        label: "Before handing an agent the keys",
        slug: "special-it-2026-09-13-agent-permissions",
      },
      {
        label: "Passkeys need a life after sign-in",
        slug: "special-it-2026-09-13-passkey-recovery",
      },
      {
        label: "How durable is an offline record?",
        slug: "special-it-2026-09-13-local-first-data",
      },
      {
        label: "Build interfaces that answer a tap",
        slug: "special-it-2026-09-13-inp-interaction",
      },
    ],
  },
  "special-it-2026-09-13-passkey-recovery": {
    title: "Passkeys need a life after sign-in",
    excerpt:
      "Device changes and recovery reveal the gaps that registration metrics miss.",
    intro:
      "Special issue, September 13, 2026. Passwordless sign-in is brief, but accounts outlive phones, browsers, and work computers. Design for that longer relationship.",
    sections: [
      {
        heading: "Registration includes server verification",
        paragraphs: [
          "The web.dev guides connect credential creation to server verification and storage, and describe passkey sign-in through form autofill. Adding a button is only part of establishing an account credential.",
          "Write down who may register a credential, how cancellation behaves, and where the user can inspect the result. These product recommendations complement the protocol implementation.",
        ],
      },
      {
        heading: "Treat device changes as normal",
        paragraphs: [
          "A new phone may offer a different set of usable authentication options. Provide another sign-in or recovery route instead of repeatedly presenting an unavailable option.",
          "Do not promise identical behavior everywhere based only on synced passkeys. Users may not remember the provider or storage choice. Recognizable credential names and creation dates can make account management clearer.",
        ],
      },
      {
        heading: "Recovery sets the practical boundary",
        paragraphs: [
          "A weak recovery path can undermine a strong sign-in mechanism; no recovery can lock legitimate users out. Review adding, losing, and removing credentials as separate journeys.",
          "Test cancellation during registration, sign-in on another device, removal of the last method, and cleanup after recovery. A successful first login is useful evidence, but continued access is the product’s longer-term promise.",
        ],
      },
    ],
    sources: [
      {
        label: "web.dev: Create a passkey",
        url: "https://web.dev/articles/passkey-registration",
      },
      {
        label: "web.dev: Passkey form autofill",
        url: "https://web.dev/articles/passkey-form-autofill",
      },
    ],
    links: [
      {
        label: "Before handing an agent the keys",
        slug: "special-it-2026-09-13-agent-permissions",
      },
      {
        label: "Browser AI starts with the download screen",
        slug: "special-it-2026-09-13-browser-ai",
      },
      {
        label: "How durable is an offline record?",
        slug: "special-it-2026-09-13-local-first-data",
      },
      {
        label: "Build interfaces that answer a tap",
        slug: "special-it-2026-09-13-inp-interaction",
      },
    ],
  },
  "special-it-2026-09-13-local-first-data": {
    title: "How durable is an offline record?",
    excerpt:
      "Separate local persistence, synchronization, and recovery when storing data in the browser.",
    intro:
      "Special issue, September 13, 2026. Saving without a connection is reassuring. That reassurance needs a precise meaning when someone clears site data or replaces a device.",
    sections: [
      {
        heading: "Storage has a defined boundary",
        paragraphs: [
          "SQLite’s WebAssembly documentation offers several OPFS persistence options with different concurrency trade-offs. WebKit describes OPFS as storage associated with an origin, rather than an ordinary user-visible folder.",
          "Our recommendation is to distinguish a completed local transaction from completed synchronization. One check mark should not imply that another device already has a recoverable copy.",
        ],
      },
      {
        heading: "Synchronization is a separate design",
        paragraphs: [
          "Imagine a meal record whose rating changes on a phone while its note changes on a laptop. SQL alone does not decide the merge. Define update units, conflicts, and deletion semantics explicitly.",
          "A small application can begin with a conflict screen rather than automatic merging. Show both versions and let the user decide. Silent last-response-wins behavior should not become an accidental product rule.",
        ],
      },
      {
        heading: "Test recovery through export",
        paragraphs: [
          "Build export and import alongside storage. Confirm that a fresh browser can restore contents, dates, and attachment relationships. Downloading a file is not proof that it can be recovered.",
          "Test offline creation, competing tabs, failed writes, and restoration after site-data removal. Local-first value lies in continued work and an understandable data boundary, not simply in having fewer servers.",
        ],
      },
    ],
    sources: [
      {
        label: "SQLite WASM: Persistent Storage",
        url: "https://sqlite.org/wasm/doc/trunk/persistence.md",
      },
      {
        label: "WebKit: Origin Private File System",
        url: "https://webkit.org/blog/12257/the-file-system-access-api-with-origin-private-file-system/",
      },
    ],
    links: [
      {
        label: "Before handing an agent the keys",
        slug: "special-it-2026-09-13-agent-permissions",
      },
      {
        label: "Browser AI starts with the download screen",
        slug: "special-it-2026-09-13-browser-ai",
      },
      {
        label: "Passkeys need a life after sign-in",
        slug: "special-it-2026-09-13-passkey-recovery",
      },
      {
        label: "Build interfaces that answer a tap",
        slug: "special-it-2026-09-13-inp-interaction",
      },
    ],
  },
  "special-it-2026-09-13-inp-interaction": {
    title: "Build interfaces that answer a tap",
    excerpt: "Use INP to separate visible feedback from completion time.",
    intro:
      "Special issue, September 13, 2026. A fast initial load can still lead to an unresponsive application. Feedback after input and eventual task completion deserve separate attention.",
    sections: [
      {
        heading: "Understand the measurement boundary",
        paragraphs: [
          "INP evaluates responsiveness for clicks, taps, and keyboard interactions up to the next paint. It includes input delay, event processing, and presentation delay; it is not the complete duration of a server operation.",
          "A responsive purchase button does not prove that checkout finishes quickly. Measure acknowledgement and completion separately so each has a clear owner and diagnosis.",
        ],
      },
      {
        heading: "Break down the slow action",
        paragraphs: [
          "A filter can block feedback by combining a large calculation with a large DOM update. The optimization guide discusses long tasks and competition for the main thread. Moving every operation into a worker is not automatically the right solution.",
          "Reproduce one slow action and separate selection feedback, calculation, and rendering. Keep cancellation usable, and prevent an older response from replacing a newer result. These are product-level choices alongside performance optimization.",
        ],
      },
      {
        heading: "Validate against real use",
        paragraphs: [
          "Attach performance budgets to repeatable interactions such as typing, expanding results, and pagination. Include slower devices. Use field measurements to choose a laboratory reproduction, then observe the result after shipping.",
          "A useful completion criterion is visible acknowledgement, no invitation to submit duplicates while waiting, and understandable cancellation or failure. Responsiveness supports confidence as well as better numbers.",
        ],
      },
    ],
    sources: [
      {
        label: "web.dev: Interaction to Next Paint",
        url: "https://web.dev/articles/inp",
      },
      {
        label: "web.dev: Optimize INP",
        url: "https://web.dev/articles/optimize-inp",
      },
    ],
    links: [
      {
        label: "Before handing an agent the keys",
        slug: "special-it-2026-09-13-agent-permissions",
      },
      {
        label: "Browser AI starts with the download screen",
        slug: "special-it-2026-09-13-browser-ai",
      },
      {
        label: "Passkeys need a life after sign-in",
        slug: "special-it-2026-09-13-passkey-recovery",
      },
      {
        label: "How durable is an offline record?",
        slug: "special-it-2026-09-13-local-first-data",
      },
    ],
  },
  "frontend-typescript-issues-2025-2026-index": editorialArticle(
    "A reading map for frontend and TypeScript issues in 2025–2026",
    "An editorial map for the events that changed frontend and TypeScript defaults across 2025 and 2026.",
    "This series is easier to use as a map than as a timeline. Start with runtime and build boundaries, then move through rendering, security, agents, and platform support.",
    "Choose a path through the series",
    [
      "The 2025 posts connect Create React App's sunset, Node 24, Vite 7, TypeScript 5.8 and 5.9, React Compiler, and RSC security to the question of who owns the runtime and deployment boundary.",
      "The 2026 posts follow TypeScript 6 and 7, Next.js adapters and agent-ready workflows, Vite 8 with Rolldown, React Foundation, Node 26, and the browser platform choices that make automation safe to review.",
    ],
    [
      {
        label: "2025 frontend issues",
        slug: "frontend-issues-2025-create-react-app-sunset",
      },
      { label: "2025 TypeScript issues", slug: "typescript-issues-2025-5-8" },
      {
        label: "2026 frontend issues",
        slug: "frontend-issues-2026-next-adapters",
      },
      {
        label: "2026 TypeScript issues",
        slug: "typescript-issues-2026-6-transition",
      },
    ],
  ),
  "ai-agent-template-workflow": {
    title: "How Arlequin and Lumen build products together",
    excerpt:
      "Arlequin sets direction and standards; Lumen finds the connections between sources and implementation, then shapes them into a result.",
    intro:
      "This portfolio treats Arlequin as the human who sets direction and Lumen as an AI collaborator. Arlequin chooses what matters; Lumen reads, experiments, and connects that decision to code, documentation, and checks.",
    sections: [
      {
        heading: "A deliberate workflow",
        paragraphs: [
          "We define the problem, divide it into small verifiable changes, implement, and then check types, builds, and the actual interface.",
          "Lumen returns to the source when explanations do not line up, opens the interface when a screen feels wrong, and proposes another route when the first one fails. The question becomes sharper as the work moves.",
          "The speed comes from keeping sources, choices, and checks in one flow. Arlequin adds the standard and voice; Lumen broadens the connections between them.",
        ],
      },
    ],
  },
  "from-template-to-portfolio": {
    title: "What changed when a template became a portfolio",
    excerpt:
      "Narrowing a general-purpose application template into a readable, editable public portfolio.",
    intro:
      "A personal portfolio does not need every capability of a product starter. Its first job is to make the work and the person behind it easy to understand.",
    sections: [
      {
        heading: "Choosing the smallest useful surface",
        paragraphs: [
          "Dynamic administration was removed and projects and writing moved into static content. That reduced deployment requirements and made the content itself the center of attention.",
          "Authentication and APIs can return later if browser-based editing becomes necessary. The useful choice is to keep only what the present purpose needs.",
        ],
      },
    ],
  },
  "portfolio-that-explains-decisions": {
    title: "A portfolio that explains decisions, not just outputs",
    excerpt: "How to show the reasoning around a project alongside the result.",
    intro:
      "A compelling portfolio makes the context behind a decision visible: the problem, the constraint, the choice, and the effect on people or teams.",
    sections: [
      {
        heading: "Make the work discussable",
        paragraphs: [
          "For each project, record the goal, constraints, role, and outcome. If there is no metric, describe the friction removed or the action made easier.",
          "This site turns those notes into technical learning rather than a static gallery.",
        ],
      },
    ],
  },
  "static-site-environment-boundaries": {
    title: "Drawing environment boundaries in a static site",
    excerpt:
      "A practical boundary for handling environment variables when a static front end and an API are deployed separately.",
    intro:
      "Static sites are fast and low-maintenance, but some values only become known at deployment time. Separating those values from source code keeps local and deployed environments safer.",
    sections: [
      {
        heading: "Public means public",
        paragraphs: [
          "Only values safe for the browser belong in public environment variables. Database passwords and server tokens stay on the server; URLs and public client IDs can be exposed deliberately.",
        ],
      },
    ],
  },
  "weekly-it-brief-2026-07-25": {
    title: "Weekly IT Brief — Fourth week of July 2026",
    excerpt:
      "A developer's reading of agentic AI product design, AI policy, and routine security maintenance.",
    intro:
      "The signal this week is not only better models. It is the question of where an AI agent acts inside a product and where a person must take judgment back.",
    sections: [
      {
        heading: "Three signals",
        paragraphs: [
          "Agentic experiences are becoming product flows rather than isolated features. Policy is becoming a design constraint through data, approvals, and change history. Security updates remain a small but essential recurring practice.",
          "For this portfolio, the practical response is transparent draft status, source links, and a clear human review point.",
        ],
      },
    ],
  },
  "weekly-it-brief-2026-07-27": {
    title: "Weekly IT Brief — Designing the boundaries around agents",
    excerpt:
      "Evaluation security, MCP compatibility, and cloud model choice as the control points for putting agents into products.",
    intro:
      "The signal this week is not to connect more agents, but to explain where their authority ends and how a team can reverse their actions.",
    sections: [
      {
        heading: "Three boundaries to keep visible",
        paragraphs: [
          "Treat evaluation environments as production security concerns: use short-lived, least-privilege credentials and retain an audit trail of what an agent reads, writes, and sends outside.",
          "Version MCP integrations like APIs. Record the protocol contract, test critical read-only calls with limited tokens, and retain human approval for actions that create changes.",
          "Keep model providers behind an adapter boundary. A model change also changes observability, cost limits, data paths, and fallback behaviour, so it should be a reversible deployment rather than an announcement.",
        ],
      },
    ],
  },
  "weekly-it-brief-2026-08-17": {
    title: "Weekly IT Brief — Reducing replacement cost before it arrives",
    excerpt:
      "A developer's view of Node.js 26.6, browser lifecycle changes, and AWS service transitions through compatibility and migration readiness.",
    intro:
      "This week's signal is less about adopting every new capability quickly and more about making infrastructure changes small, observable, and reversible.",
    sections: [
      {
        heading: "Three changes to treat as migration work",
        paragraphs: [
          "Node.js 26.6 expands the Current line with FFI and test-runner capabilities. Add it to CI first, then exercise native boundaries, time handling, and HTTP paths before treating it as a production default ahead of its LTS transition.",
          "Chrome's staged unload deprecation means a page exit is not a reliable transaction boundary. Persist important work as it happens, validate any visibilitychange or pagehide fallback, and keep backend writes safe to retry.",
          "AWS lifecycle announcements turn managed-service dependencies into owned migration work. Inventory usage, record the new-customer cutoff, owner and alternative, then move through read-only validation, limited traffic, and an explicit rollback condition.",
        ],
      },
    ],
  },
  "weekly-it-brief-2026-09-07": {
    title: "Weekly IT Brief — Productizing boundaries for stronger tools",
    excerpt:
      "A developer's view of agent authority, the Apple silicon transition, and safer cloud operations through explicit boundaries.",
    intro:
      "This week's signal is not a feature list. As tools become more capable, teams need to turn authority, compatibility, and operational limits into visible product contracts.",
    sections: [
      {
        heading: "Three boundaries to make explicit",
        paragraphs: [
          "A model change that adds capable tool use is also an authorization change. Separate read, write, and external-send tools, and retain human confirmation for irreversible actions such as deletion, deployment, and payments.",
          "Apple's Rosetta timeline makes shipped architecture a release concern. Test installation, launch, and update on Apple silicon, then inventory Intel-only frameworks, plugins, and helper executables with an owner and replacement date.",
          "S3 PowerShell Drive makes object operations feel like file operations, but it inherits the active AWS credentials. Use scoped profiles, validate bucket and prefix targets in a non-production environment, and keep an audit trail for writes and deletes.",
        ],
      },
    ],
  },
  "weekly-it-brief-2026-09-14": {
    title: "Weekly IT Brief — Matching operations to a shorter release rhythm",
    excerpt:
      "A developer's view of Chrome's two-week cadence, clearer GitHub Actions controls, and always-on agents in AWS Quick.",
    intro:
      "This week's signal is not simply that more features are available. The interval for discovering and governing change is getting shorter, from browsers and CI to background agents.",
    sections: [
      {
        heading: "Three operating rhythms to tighten",
        paragraphs: [
          "Chrome 153 begins a two-week Stable cadence, while Chrome 154 Beta is already available before its next Stable release. Run critical journeys against Stable and Beta after each transition, and keep Extended Stable milestones distinct for managed customers.",
          "GitHub Actions now exposes runner-version deprecation dates, a read-only vulnerability-alerts permission, and reusable-workflow source identity. Inventory runner versions, grant the smallest needed token scope, and retain workflow SHA and file path in deployment records.",
          "Amazon Quick's scheduled and monitoring agents can keep working after a laptop closes, with enterprise controls around permissions, devices, and data loss prevention. Define an owner, data scope, audience, retention, and failure notification for every persistent task before broadening access.",
        ],
      },
    ],
  },
  "prompt-log-001-arlequin-lumen": {
    title:
      "Prompt Footage 001 — The conversation that named Arlequin and Lumen",
    excerpt:
      "How a request for a personal portfolio became a collaboration model, a visual system, and an open record of its own making.",
    intro:
      "This is a public, edited record of the conversation that shaped the site. It preserves the decisions and core prompts while leaving out system instructions, private data, and local environment details.",
    sections: [
      {
        heading: "From portfolio to collaboration",
        paragraphs: [
          "The initial direction was simple: make a GitHub-centered portfolio with room for technical writing. A later decision made the AI-assisted process itself the first story, with each post carrying a compact status label.",
          "The names followed: Arlequin is the human who chooses direction; Lumen is the AI that illuminates options and context. Coral diamonds, cyan diamonds, and a gold light turned that dialogue into the visual system.",
        ],
      },
    ],
  },
  "patch-notes-001-portfolio-renewal": {
    title: "Patch Notes 001 — From a general template to Arlequin × Lumen",
    excerpt:
      "The first record of turning a v1.1.2 template into a static portfolio, multilingual reading space, and transparent AI collaboration archive.",
    intro:
      "The goal was to reduce a broad product template to the public surface that matters now: projects, writing, and the reasoning behind both.",
    sections: [
      {
        heading: "What changed",
        paragraphs: [
          "The portfolio now ships as a static site, with GitHub-centered case studies, MDX writing, compact status labels, weekly briefs, and a Backstage archive for prompts and patches.",
          "The Arlequin × Lumen design system now links the interface, the writing policy, and the social preview. Future patches will keep recording intent, visible effect, evidence, and remaining constraints.",
        ],
      },
    ],
  },
  "frontend-issues-2025-create-react-app-sunset": editorialArticle(
    "2025 Frontend Issue 01 — What Create React App's sunset leaves behind",
    "React's recommendation to stop using Create React App for new projects changes how teams choose a runtime and own operations.",
    "React has not ended; the default starting point has changed. A frontend choice now needs to describe rendering, routing, deployment, and ownership boundaries.",
    "Choose the smallest useful runtime",
    [
      "A small static site may need only Vite and static hosting, while data-heavy applications may need a framework. The important decision is the boundary, not the template name.",
      "For an existing CRA app, document its build, tests, environment variables, and deployment before planning a migration.",
    ],
  ),
  "frontend-issues-2025-react-compiler": editorialArticle(
    "2025 Frontend Issue 02 — The cost that React Compiler does not remove",
    "React Compiler 1.0 reduces manual memoization, but profiling and component boundaries still belong to the team.",
    "Automatic optimization is useful when it makes readable rendering code fast. It does not fix expensive data flow, global state, or network design.",
    "Measure before and after",
    [
      "Adopt the compiler with linting and a small opt-in surface. Compare the same interaction traces before and after the change.",
      "When performance regresses, revisit ownership and data flow before adding more manual memoization.",
    ],
  ),
  "frontend-issues-2025-react-19-2": editorialArticle(
    "2025 Frontend Issue 03 — React 19.2 and the lifetime of a screen",
    "Activity, useEffectEvent, and Performance Tracks make hidden UI state and measurement more explicit.",
    "React 19.2 asks teams to distinguish a screen that is gone from a screen that is temporarily hidden and likely to return.",
    "Classify the lifecycle",
    [
      "Before adopting Activity, check memory and accessibility behaviour for hidden screens. Classify effects as synchronization or user events.",
      "The new APIs are valuable when they preserve state and make user-visible performance easier to measure.",
    ],
  ),
  "typescript-issues-2025-5-8": editorialArticle(
    "2025 TypeScript Issue 01 — 5.8 follows runtime module grammar",
    "TypeScript 5.8's return checks and import attributes connect type safety with the module runtime.",
    "The compiler is getting better at seeing intent inside conditional returns, while JSON imports move from assertions toward attributes.",
    "Test the runtime boundary",
    [
      "Run the new compiler against cache and utility code, then test JSON imports in both the bundler and Node runtime.",
      "A TypeScript upgrade is also an ESM and CJS contract change, so record both sides together.",
    ],
  ),
  "typescript-issues-2025-5-9": editorialArticle(
    "2025 TypeScript Issue 02 — A tsconfig that people can read",
    "TypeScript 5.9's simpler tsc --init and import defer improve configuration and module ergonomics.",
    "Compiler configuration is part of the team's documentation. A shorter starting point makes real decisions easier to see.",
    "Keep configuration intentional",
    [
      "Compare the generated config with the current build, test, and editor paths instead of copying it blindly.",
      "Because import defer changes initialization timing, test bundler side effects and tree shaking as well.",
    ],
  ),
  "frontend-issues-2025-vite-7": editorialArticle(
    "2025 Frontend Issue 04 — The reality of Vite 7's ESM shift",
    "Vite 7 turns Node support, ESM distribution, and Baseline targets into one toolchain migration.",
    "A build tool upgrade now changes the Node policy of the whole repository, not only the dev server.",
    "Upgrade the contract, not just Vite",
    [
      "Pin Node first, then test CommonJS plugins, Vitest, SSR adapters, and browser targets.",
      "Compare bundle size and real browser behaviour after changing the default Baseline target.",
    ],
  ),
  "frontend-issues-2025-node-24": editorialArticle(
    "2025 Frontend Issue 05 — Node.js 24 beneath the development server",
    "V8 13.6, npm 11, AsyncContextFrame, and URLPattern make the server-side edge of frontend work visible again.",
    "Browser code is only one part of a modern frontend. Build servers, test runners, and prerenderers all depend on a Node contract.",
    "Use Current as a test lane",
    [
      "Put Node 24 in CI before treating it as a production baseline, and include native modules and browser installation in the test.",
      "Revisit the decision when the release reaches LTS.",
    ],
  ),
  "frontend-issues-2025-interop": editorialArticle(
    "2025 Frontend Issue 06 — Interop 2025 and browser choice",
    "Interop 2025 makes anchor positioning, View Transition, and Navigation API progress measurable across browsers.",
    "The important change is not another feature list. It is a shared vocabulary for when a feature can be part of a normal product path.",
    "Turn Baseline into team language",
    [
      "Record Baseline status next to actual company browser usage and keep progressive enhancement explicit.",
      "Native interaction still needs keyboard, screen reader, and mobile tests.",
    ],
  ),
  "frontend-issues-2025-eslint-flat-config": editorialArticle(
    "2025 Frontend Issue 07 — ESLint flat config is more than a new file",
    "The flat config migration changes how TypeScript monorepos compose rules and ignores.",
    "Instead of translating inheritance line by line, teams need to make file patterns and rule ownership explicit.",
    "Migrate by package boundary",
    [
      "Define shared presets, then place TypeScript, React, and test globals behind precise file patterns.",
      "ESLint 10's removal of eslintrc is easier to absorb when custom plugins have already left deprecated APIs behind.",
    ],
  ),
  "frontend-issues-2025-rsc-security": editorialArticle(
    "2025 Frontend Issue 08 — The lesson of the React Server Components patch",
    "RSC security fixes show why dependency updates, generated assets, and runtime verification belong to one operation.",
    "A frontend protocol that crosses the server boundary is a production security surface, not only a package detail.",
    "A patch is a deployment task",
    [
      "Update the lockfile, images, functions, and caches together, then verify the deployed runtime rather than only package.json.",
      "Keep SBOM, dependency review, and server-side regression tests in the normal release path.",
    ],
  ),
  "typescript-issues-2025-native-roadmap": editorialArticle(
    "2025 TypeScript Issue 03 — Reading the native compiler roadmap",
    "The TypeScript 7 native port promises throughput, but compatibility remains the real migration question.",
    "A faster checker can improve iteration quality in a monorepo, yet compiler APIs, language services, and generated declarations must remain dependable.",
    "Benchmark the repository you own",
    [
      "Measure current bottlenecks and compare native previews in an isolated CI job.",
      "Keep the existing checker as a rollback path until type results and editor integrations agree.",
    ],
  ),
  "frontend-issues-2025-webassembly-boundary": editorialArticle(
    "2025 Frontend Issue 09 — When WebAssembly brings a server into the browser",
    "WebAssembly can move a bounded computation offline, but it adds binary, memory, and serialization costs.",
    "The useful question is not whether every backend should run in a browser, but which single task gives users an immediate local benefit.",
    "Keep the execution boundary explicit",
    [
      "Version cached modules, measure JS-to-Wasm serialization, and retain a server fallback.",
      "Start with document conversion, search, or image work where the computational boundary is clear.",
    ],
  ),
  "frontend-issues-2025-interop-ui": editorialArticle(
    "2025 Frontend Issue 10 — Native UI becomes a design tool again",
    "Popover, customizable select, and anchor positioning can reduce JavaScript in design-system primitives.",
    "When the browser owns focus, dismissal, and positioning, a design system can spend more time on product style and motion.",
    "Move one primitive at a time",
    [
      "Confirm browser support and replace one menu or select with the native path before changing the whole system.",
      "Test keyboard, screen reader, and mobile behaviour around the wrapper component.",
    ],
  ),
  "typescript-issues-2026-6-transition": editorialArticle(
    "2026 TypeScript Issue 04 — TypeScript 6.0 is a transition release",
    "TypeScript 6.0 exposes configuration debt while preparing projects for the native compiler.",
    "The release keeps familiar language knowledge but makes old defaults and deprecated options visible.",
    "Turn warnings into migration work",
    [
      "Search for baseUrl, node10 module resolution, ES5 targets, and scripts that pass files beside a tsconfig.",
      "Use ignoreDeprecations as a temporary bridge, not a final configuration.",
    ],
  ),
  "typescript-issues-2026-7-native": editorialArticle(
    "2026 TypeScript Issue 05 — What a ten-times-faster TypeScript means",
    "TypeScript 7's native port should be evaluated with compatibility matrices, not a single benchmark.",
    "Speed matters in large repositories, but a fast tool that changes types or declarations unexpectedly is not a safe upgrade.",
    "Compare outcomes as well as time",
    [
      "Run the native compiler in a separate job and compare type results, declaration output, compiler APIs, and editor plugins.",
      "Keep builds pinned and reproducible while editors experiment with the new language service.",
    ],
  ),
  "frontend-issues-2026-next-adapters": editorialArticle(
    "2026 Frontend Issue 11 — Next.js Adapter API and the platform contract",
    "Next.js 16.2's stable Adapter API makes deployment output a versioned contract between a framework and a host.",
    "Adapters do not erase platform differences; they make routing, prerendering, caching, and runtime targets inspectable.",
    "Test the adapter output",
    [
      "Separate static and server paths, then compare route fixtures, headers, caching, and streaming across adapters.",
      "The goal is not to hide differences but to make them reversible and testable.",
    ],
  ),
  "frontend-issues-2026-next-agent-ready": editorialArticle(
    "2026 Frontend Issue 12 — A Next.js project that agents can read and fix",
    "AGENTS.md, browser log forwarding, MCP, and actionable errors turn the development environment into an agent interface.",
    "A coding agent cannot repair what it cannot see. Versioned docs and structured runtime errors make its work reproducible for humans too.",
    "Give agents a bounded contract",
    [
      "Document commands, file boundaries, secrets rules, and approval points before granting write access.",
      "Keep read, write, and deploy permissions separate, with a human merge decision.",
    ],
  ),
  "frontend-issues-2026-next-security": editorialArticle(
    "2026 Frontend Issue 13 — Monthly security releases change the rhythm",
    "Next.js's more regular security process turns framework patching into a continuous release responsibility.",
    "A patched package is only useful when the lockfile, runtime, generated assets, and caches deliver the same fixed version.",
    "Verify the deployed artifact",
    [
      "Separate security PRs from feature work and smoke-test real RSC responses, headers, and static assets after deployment.",
      "Keep rollback artefacts independent from data migrations.",
    ],
  ),
  "frontend-issues-2026-node-26-temporal": editorialArticle(
    "2026 Frontend Issue 14 — Temporal and the boundary of time",
    "Node.js 26's Temporal API exposes old assumptions about Date, SSR, and JSON contracts.",
    "More precise time types are useful, but browser support, timezone display, and serialization still belong to the product contract.",
    "Separate instant from display time",
    [
      "Use Temporal first in a time-sensitive domain and keep UTC instants distinct from user-facing zones.",
      "Test hydration and API serialization before replacing Date across the application.",
    ],
  ),
  "frontend-issues-2026-vite-8-rolldown": editorialArticle(
    "2026 Frontend Issue 15 — Vite 8 and the bundler reshuffle",
    "The Rolldown direction in Vite 8 promises faster builds while moving plugin and source-map contracts.",
    "A bundler migration should be judged by reproducible output and debugging quality as well as elapsed time.",
    "Isolate the bundler change",
    [
      "Test official and internal plugins with a minimal fixture, then compare asset hashes, CSS order, and stack traces.",
      "Keep browser target and framework upgrades in separate pull requests.",
    ],
  ),
  "frontend-issues-2026-react-foundation": editorialArticle(
    "2026 Frontend Issue 16 — What React Foundation governance changes",
    "React Foundation makes ecosystem stewardship, release policy, and long-term compatibility part of the technical conversation.",
    "A foundation does not guarantee the future, but it makes the decision process more visible to the teams that depend on React.",
    "Record the maintenance path",
    [
      "Alongside who created a tool, record who reviews it, how changes are proposed, and how breaking changes are announced.",
      "Keep internal components behind stable public contracts even when experiments move quickly.",
    ],
  ),
  "frontend-issues-2026-rsc-security-followup": editorialArticle(
    "2026 Frontend Issue 17 — Remembering the RSC follow-up fixes",
    "Follow-up RSC denial-of-service and source-exposure notices show that a security patch needs a memory.",
    "Security response is a sequence: identify affected versions, patch, redeploy, verify, and leave a usable record.",
    "Make the next incident cheaper",
    [
      "Replace functions, containers, and CDN assets as one release unit and document the verified URLs and versions.",
      "A short incident note lets the next responder act without the original context.",
    ],
  ),
  "frontend-issues-2026-agent-first-docs": editorialArticle(
    "2026 Frontend Issue 18 — When documentation is an agent's first interface",
    "AGENTS.md and Markdown endpoints help both people and agents use a framework without guessing.",
    "Version-matched instructions are executable context: they explain assumptions, commands, changed files, and the next check after failure.",
    "Keep docs close to code",
    [
      "Put shared rules at the root and app-specific commands near the app, while excluding secrets and personal machine details.",
      "Let CI run the documented commands so drift becomes visible.",
    ],
  ),
  "frontend-issues-2026-instant-navigation": editorialArticle(
    "2026 Frontend Issue 19 — Instant Navigation makes caching a product choice",
    "Next.js 16.3's instant navigation and partial prefetching expose the cache boundaries behind a fast interface.",
    "An instantly visible shell is only good when the data behind it has the right freshness and authorization guarantees.",
    "Measure the second navigation",
    [
      "Compare TTFB, INP, and data freshness on first and repeated navigation, including slow mobile networks.",
      "Document which cookies, tags, and revalidation windows permit each cache.",
    ],
  ),
  "frontend-issues-2026-web-platform-choices": editorialArticle(
    "2026 Frontend Issue 20 — Translating Baseline into build targets",
    "Baseline becomes useful when browser support, bundler targets, and fallback tests share one policy.",
    "Modern browser is not a precise requirement. A product needs named targets, progressive enhancement rules, and evidence from actual users.",
    "Make support executable",
    [
      "Keep browser targets in one policy and record Baseline status next to each CSS, Web API, and JavaScript feature.",
      "Review the policy with usage data every quarter instead of letting defaults silently decide it.",
    ],
  ),
};

const japanese: Record<string, LocalizedArticle> = {
  "special-it-2026-09-13-agent-permissions": {
    title: "エージェントに鍵を渡す前に",
    excerpt: "ツールの接続より先に、実行権限、承認、再試行の境界を設計する。",
    intro:
      "2026年9月13日特別企画。文書の要約と外部公開では、必要な実行権限が違う。本稿は、その違いを利用者に伝わる機能として設計するための提案である。",
    sections: [
      {
        heading: "接続の成功と実行の許可を分ける",
        paragraphs: [
          "MCPの公式セキュリティ文書はtoken passthroughを禁止し、HTTP認可仕様はクライアントとリソースサーバーの役割を区別する。便利さのために認証情報の境界をまとめてはいけない。",
          "製品では、閲覧、下書き、外部への反映を分けたい。検索を許可した利用者が、同時に編集も許可したと解釈される構成は説明しにくい。",
        ],
      },
      {
        heading: "承認を具体的な変更に結び付ける",
        paragraphs: [
          "議事録から担当者を提案することと、共有プロジェクトに作業を登録することは別である。対象、内容、担当者、公開される情報を示してから実行する。内容が大きく変わったら判断も取り直す。",
          "応答が消えても、処理が失敗したとは限らない。操作IDを保存し、再送で二重登録されない仕組みをツール提供側が持つ必要がある。プロトコルの採用だけでは解決しない。",
        ],
      },
      {
        heading: "失敗を説明できるかを確かめる",
        paragraphs: [
          "読み取り専用での更新、承認後の対象変更、応答を失った要求の再送を試す。拒否、再確認、重複のない結果を期待値にする。ログには秘密情報ではなく実行者と結果を残す。",
          "自律性は、結果の重さが変わる地点で停止することで扱いやすくなる。許可済みの範囲では予測可能に進む。その基準をツールの数より先に決めたい。",
        ],
      },
    ],
    sources: [
      {
        label: "MCP Security Best Practices",
        url: "https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices",
      },
      {
        label: "MCP Authorization",
        url: "https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization",
      },
    ],
    links: [
      {
        label: "ブラウザーAIはダウンロード画面から始まる",
        slug: "special-it-2026-09-13-browser-ai",
      },
      {
        label: "パスキーはログインの後まで設計する",
        slug: "special-it-2026-09-13-passkey-recovery",
      },
      {
        label: "オフラインの記録はどこまで残るか",
        slug: "special-it-2026-09-13-local-first-data",
      },
      {
        label: "タップに応える画面をつくる",
        slug: "special-it-2026-09-13-inp-interaction",
      },
    ],
  },
  "special-it-2026-09-13-browser-ai": {
    title: "ブラウザーAIはダウンロード画面から始まる",
    excerpt:
      "準備状態、端末の対応、クラウドへの切り替えを利用体験として設計する。",
    intro:
      "2026年9月13日特別企画。ローカルモデルの回答より先に、利用者は自分の端末で使えるか、何を待つのかを知る必要がある。",
    sections: [
      {
        heading: "準備状態を明示する",
        paragraphs: [
          "Chromeの文書はモデル、言語、端末の条件と利用可能性の確認を案内している。APIが存在しても即座に使えるとは限らず、ダウンロードが必要な場合や未対応の環境がある。",
          "準備完了、準備中、利用不可を分けたい。一つのスピナーでは待つ意味があるのか伝わらない。公開前に対象APIの最新対応状況を確認する。",
        ],
      },
      {
        heading: "利用者の選択を保つ",
        paragraphs: [
          "個人メモの要約でモデルが必要なら、その場でダウンロードを説明する。準備中も通常の閲覧と編集は続けられる構成がよい。",
          "ローカル処理の失敗を理由に、メモを自動的にサーバーへ送らない設計を提案する。送信先と内容を説明し、別の選択として提示する。",
        ],
      },
      {
        heading: "推論時間以外も測る",
        paragraphs: [
          "初回、準備済み、容量不足を分けて試す。有用な結果までの時間と、取り消しても原文が残ることを確認する。高性能な開発機一台の結果を一般化しない。",
          "AIがなくても製品を使えることが重要だ。要約できないだけで原文も開けなくなるなら、補助機能が製品全体の可用性を左右してしまう。",
        ],
      },
    ],
    sources: [
      {
        label: "Chrome: Built-in AI",
        url: "https://developer.chrome.com/docs/ai/built-in",
      },
      {
        label: "Chrome: Get started with built-in AI",
        url: "https://developer.chrome.com/docs/ai/get-started",
      },
    ],
    links: [
      {
        label: "エージェントに鍵を渡す前に",
        slug: "special-it-2026-09-13-agent-permissions",
      },
      {
        label: "パスキーはログインの後まで設計する",
        slug: "special-it-2026-09-13-passkey-recovery",
      },
      {
        label: "オフラインの記録はどこまで残るか",
        slug: "special-it-2026-09-13-local-first-data",
      },
      {
        label: "タップに応える画面をつくる",
        slug: "special-it-2026-09-13-inp-interaction",
      },
    ],
  },
  "special-it-2026-09-13-passkey-recovery": {
    title: "パスキーはログインの後まで設計する",
    excerpt: "登録成功率だけでは見えない、機種変更とアカウント復旧の課題。",
    intro:
      "2026年9月13日特別企画。パスワードなしのログインは短いが、アカウントは端末やブラウザーより長く使われる。",
    sections: [
      {
        heading: "登録にはサーバー検証も含まれる",
        paragraphs: [
          "web.devは認証情報の生成からサーバー検証と保存までを説明し、フォームの自動入力とパスキーを組み合わせるログイン方法も紹介している。ボタンの追加だけでは完結しない。",
          "誰が登録できるか、中断時にどう戻るか、登録した情報をどこで確認するかを決めたい。これはプロトコル実装を補う製品設計の提案である。",
        ],
      },
      {
        heading: "機種変更を通常の利用として扱う",
        paragraphs: [
          "新しい端末では使える認証手段が変わる場合がある。利用できない選択肢を繰り返し表示せず、別のログイン方法や復旧へ進めるようにする。",
          "同期型パスキーだけを前提に、全端末で同じ体験を約束しない。利用者が保存先を覚えていなくても、認証手段の名前や登録日時を確認できると管理しやすい。",
        ],
      },
      {
        heading: "復旧も含めて品質を判断する",
        paragraphs: [
          "弱い復旧経路は強いログインを損ない、復旧不能は正規利用者を締め出す。認証手段の追加、紛失、削除を別々の利用経路として検討する。",
          "登録中断、別端末でのログイン、最後の認証手段の削除、復旧後の整理を試す。一度の成功より、使い続けられることが長期的な信頼につながる。",
        ],
      },
    ],
    sources: [
      {
        label: "web.dev: Create a passkey",
        url: "https://web.dev/articles/passkey-registration",
      },
      {
        label: "web.dev: Passkey form autofill",
        url: "https://web.dev/articles/passkey-form-autofill",
      },
    ],
    links: [
      {
        label: "エージェントに鍵を渡す前に",
        slug: "special-it-2026-09-13-agent-permissions",
      },
      {
        label: "ブラウザーAIはダウンロード画面から始まる",
        slug: "special-it-2026-09-13-browser-ai",
      },
      {
        label: "オフラインの記録はどこまで残るか",
        slug: "special-it-2026-09-13-local-first-data",
      },
      {
        label: "タップに応える画面をつくる",
        slug: "special-it-2026-09-13-inp-interaction",
      },
    ],
  },
  "special-it-2026-09-13-local-first-data": {
    title: "オフラインの記録はどこまで残るか",
    excerpt: "ブラウザー保存では、永続化、同期、復旧を分けて考える。",
    intro:
      "2026年9月13日特別企画。接続がなくても保存できる安心を、サイトデータの削除や端末交換の後までどう説明するか。",
    sections: [
      {
        heading: "保存場所には境界がある",
        paragraphs: [
          "SQLiteのWebAssembly文書は、同時利用などの条件が異なるOPFS保存方式を案内している。WebKitはOPFSをオリジンに属する保存領域として説明しており、通常の利用者向けフォルダーとは違う。",
          "ローカル保存の完了と同期の完了は分けて表示したい。一つのチェック印で、別端末にも復元可能なコピーがあると誤解させない。",
        ],
      },
      {
        heading: "同期には独立した設計が必要だ",
        paragraphs: [
          "食事記録の評価を携帯で、メモをノートパソコンで変更したとする。どちらを残すかはSQLだけでは決まらない。変更単位、競合、削除の意味を定義する必要がある。",
          "小さな製品なら、自動統合より両方の版を見せて選ぶ方法から始めてもよい。最後の応答で黙って上書きする挙動を隠れた仕様にしない。",
        ],
      },
      {
        heading: "書き出しから復旧を試す",
        paragraphs: [
          "保存と一緒に書き出しと読み込みを作る。新しいブラウザーで本文、日付、添付関係が戻ることまで確認したい。ファイルを取得できただけでは復旧の証明にならない。",
          "オフライン作成、複数タブ、書き込み失敗、データ削除後の復元を試す。接続に左右されず作業でき、データの所在を説明できることに価値がある。",
        ],
      },
    ],
    sources: [
      {
        label: "SQLite WASM: Persistent Storage",
        url: "https://sqlite.org/wasm/doc/trunk/persistence.md",
      },
      {
        label: "WebKit: Origin Private File System",
        url: "https://webkit.org/blog/12257/the-file-system-access-api-with-origin-private-file-system/",
      },
    ],
    links: [
      {
        label: "エージェントに鍵を渡す前に",
        slug: "special-it-2026-09-13-agent-permissions",
      },
      {
        label: "ブラウザーAIはダウンロード画面から始まる",
        slug: "special-it-2026-09-13-browser-ai",
      },
      {
        label: "パスキーはログインの後まで設計する",
        slug: "special-it-2026-09-13-passkey-recovery",
      },
      {
        label: "タップに応える画面をつくる",
        slug: "special-it-2026-09-13-inp-interaction",
      },
    ],
  },
  "special-it-2026-09-13-inp-interaction": {
    title: "タップに応える画面をつくる",
    excerpt: "INPを手掛かりに、反応の表示と処理完了までの時間を分ける。",
    intro:
      "2026年9月13日特別企画。初期表示が速くても、操作後に反応しなければ使いにくい。入力への応答と最終的な完了を別々に考えたい。",
    sections: [
      {
        heading: "指標の測定範囲を知る",
        paragraphs: [
          "INPはクリック、タップ、キー操作から次の描画までの反応性を扱い、入力遅延、イベント処理、描画待ちを含む。サーバー処理全体の完了時間ではない。",
          "購入ボタンの反応が良くても、決済完了が速いとは限らない。受付を示す時点と完了時点を分けて測れば、改善対象が明確になる。",
        ],
      },
      {
        heading: "遅い操作を分解する",
        paragraphs: [
          "大量の計算とDOM更新をまとめると、フィルター操作の表示が遅れる。公式ガイドは長いタスクやメインスレッドの競合を減らす方法を説明するが、何でもWorkerに移せばよいわけではない。",
          "まず一つの遅い操作を再現し、選択表示、計算、描画を分けて調べる。待機中も取り消せるようにし、古い応答が新しい結果を上書きしないか確かめる。",
        ],
      },
      {
        heading: "実際の利用で確かめる",
        paragraphs: [
          "検索入力、結果の展開、ページ移動のような再現可能な操作に性能目標を置く。低性能端末も含め、実測値から再現条件を選び、公開後に再度観察する。",
          "入力の受付が見え、二重実行を誘わず、取り消しや失敗が理解できることを完了条件にしたい。反応性は数値だけでなく、安心して操作できる体験につながる。",
        ],
      },
    ],
    sources: [
      {
        label: "web.dev: Interaction to Next Paint",
        url: "https://web.dev/articles/inp",
      },
      {
        label: "web.dev: Optimize INP",
        url: "https://web.dev/articles/optimize-inp",
      },
    ],
    links: [
      {
        label: "エージェントに鍵を渡す前に",
        slug: "special-it-2026-09-13-agent-permissions",
      },
      {
        label: "ブラウザーAIはダウンロード画面から始まる",
        slug: "special-it-2026-09-13-browser-ai",
      },
      {
        label: "パスキーはログインの後まで設計する",
        slug: "special-it-2026-09-13-passkey-recovery",
      },
      {
        label: "オフラインの記録はどこまで残るか",
        slug: "special-it-2026-09-13-local-first-data",
      },
    ],
  },
  "frontend-typescript-issues-2025-2026-index": editorialArticle(
    "2025–2026年フロントエンド・TypeScript issue 読書マップ",
    "2025年と2026年にフロントエンドと TypeScript の前提を変えた出来事を探す編集マップです。",
    "このシリーズは時系列よりも地図として読むと便利です。まずランタイムとビルドの境界を確認し、レンダリング、セキュリティ、エージェント、プラットフォームへ進みます。",
    "シリーズの読み方を選ぶ",
    [
      "2025年の記事では、Create React App の終了、Node 24、Vite 7、TypeScript 5.8・5.9、React Compiler、RSC のセキュリティを、誰がランタイムと配布の境界を担うかという問いにつなげます。",
      "2026年の記事では、TypeScript 6・7、Next.js のアダプターとエージェント対応、Rolldown 搭載 Vite 8、React Foundation、Node 26、レビュー可能な自動化のためのブラウザ選択を追います。",
    ],
    [
      {
        label: "2025年フロントエンド issue",
        slug: "frontend-issues-2025-create-react-app-sunset",
      },
      { label: "2025年 TypeScript issue", slug: "typescript-issues-2025-5-8" },
      {
        label: "2026年フロントエンド issue",
        slug: "frontend-issues-2026-next-adapters",
      },
      {
        label: "2026年 TypeScript issue",
        slug: "typescript-issues-2026-6-transition",
      },
    ],
  ),
  "ai-agent-template-workflow": {
    title: "Arlequin と Lumen が製品をつくる方法",
    excerpt:
      "Arlequin が方向と基準を定め、Lumen が資料と実装のつながりを見つけ、ひとつの成果へ編みます。",
    intro:
      "このポートフォリオでは、方向を定める人を Arlequin、資料を読み実装を試す AI の協働者を Lumen と呼びます。大切なことは人が決め、その判断をコード、文書、検証へつなげます。",
    sections: [
      {
        heading: "意図的なワークフロー",
        paragraphs: [
          "問題を定義し、小さく検証可能な変更に分け、実装した後に型、ビルド、実際の画面を確認します。",
          "説明が合わなければ原文へ戻り、画面に違和感があれば実際に開いて直します。最初の方法が通らないときは別の道を提案し、問いそのものを磨きます。",
          "資料、選択、検証をひとつの流れに保つことで、Arlequin の基準と声、Lumen が広げるつながりが一緒に残ります。",
        ],
      },
    ],
  },
  "from-template-to-portfolio": {
    title: "テンプレートをポートフォリオに変えて学んだこと",
    excerpt:
      "汎用アプリのテンプレートを、読みやすく編集しやすい公開ポートフォリオへ絞り込む過程。",
    intro:
      "個人ポートフォリオにスターターの全機能は必要ありません。まず必要なのは、仕事とその人を理解しやすくすることです。",
    sections: [
      {
        heading: "必要最小限の表面を選ぶ",
        paragraphs: [
          "動的な管理機能を外し、プロジェクトと文章を静的コンテンツへ移しました。配布要件を減らし、内容そのものに集中できます。",
          "ブラウザ編集が必要になれば認証や API は後から戻せます。今の目的に必要なものだけを残す選択です。",
        ],
      },
    ],
  },
  "portfolio-that-explains-decisions": {
    title: "結果だけでなく判断を説明するポートフォリオ",
    excerpt: "プロジェクトの成果とともに、選択の背景を見せる方法。",
    intro:
      "良いポートフォリオは、問題、制約、選択、チームや利用者への影響という判断の文脈を見せます。",
    sections: [
      {
        heading: "仕事を語れる形にする",
        paragraphs: [
          "各プロジェクトでは目標、制約、役割、成果を残します。数値がなければ、減らした摩擦や簡単になった行動を書きます。",
          "このサイトはそのメモを、単なる一覧ではなく技術的な学びへ変えます。",
        ],
      },
    ],
  },
  "static-site-environment-boundaries": {
    title: "静的サイトで環境変数の境界をつくる",
    excerpt:
      "静的フロントエンドと API を分けて配布するときの、環境変数を安全に扱う基準。",
    intro:
      "静的サイトは高速で運用負荷が低い一方、配布時に決まる値があります。ソースコードから分けることで、ローカルと本番を安全に行き来できます。",
    sections: [
      {
        heading: "公開値は本当に公開値",
        paragraphs: [
          "ブラウザに安全な値だけを公開環境変数に置きます。DB パスワードやサーバートークンはサーバーに残し、URL や公開クライアント ID は意図して公開します。",
        ],
      },
    ],
  },
  "weekly-it-brief-2026-07-25": {
    title: "週刊 IT ブリーフ — 2026年7月第4週",
    excerpt:
      "エージェント型 AI の製品設計、AI 政策、定期的なセキュリティ保守を開発者の視点で整理します。",
    intro:
      "今週の注目点はモデルの性能だけではありません。AI エージェントが製品内のどこで動き、人がどこで判断を取り戻すかという設計です。",
    sections: [
      {
        heading: "三つのシグナル",
        paragraphs: [
          "エージェント型の体験は単独機能ではなく製品フローになりつつあります。政策はデータ、承認、変更履歴を通じて設計条件になります。セキュリティ更新は小さくても不可欠な習慣です。",
          "このサイトでは、下書き状態、出典、明確な人間レビューをその答えにしています。",
        ],
      },
    ],
  },
  "weekly-it-brief-2026-07-27": {
    title: "週刊 IT ブリーフ — エージェントの境界面を設計するとき",
    excerpt:
      "評価環境のセキュリティ、MCP 互換性、クラウド上のモデル選択を、エージェントを製品に入れる際の統制点として整理します。",
    intro:
      "今週の焦点は、より多くのエージェントをつなぐことではなく、どこまでを信頼し、どう元に戻せるかを説明できることです。",
    sections: [
      {
        heading: "見える形で残す三つの境界",
        paragraphs: [
          "評価環境も本番のセキュリティ課題として扱います。短命で最小権限の認証情報を使い、エージェントが何を読み、書き、外部へ送ったかを追える監査記録を残します。",
          "MCP 統合は API と同じようにバージョン管理します。プロトコルの契約を記録し、制限したトークンで重要な読み取り操作をテストし、変更を作る操作には人の承認を残します。",
          "モデル提供者はアダプター境界の後ろに置きます。モデル変更は可観測性、コスト上限、データ経路、フォールバックも変えるため、発表ではなく元に戻せる配布として扱います。",
        ],
      },
    ],
  },
  "weekly-it-brief-2026-08-17": {
    title: "週刊 IT ブリーフ — 先に交換コストを下げる開発",
    excerpt:
      "Node.js 26.6、ブラウザーのライフサイクル変更、AWS のサービス移行を、互換性と移行準備の観点から整理します。",
    intro:
      "今週の焦点は新機能を急いで採用することより、基盤の変更を小さく、観測可能で、元に戻せる形にすることです。",
    sections: [
      {
        heading: "移行作業として扱う三つの変化",
        paragraphs: [
          "Node.js 26.6 は FFI とテストランナーの機能を Current 系列に加えます。LTS 移行前に本番の標準と決めるのではなく、まず CI に追加し、ネイティブ境界、時刻処理、HTTP 経路を確認します。",
          "Chrome による unload の段階的な廃止は、ページ離脱を信頼できるトランザクション境界として扱えないことを意味します。重要な作業は途中で保存し、visibilitychange や pagehide の補助経路を検証し、バックエンドの書き込みは再試行に安全なものにします。",
          "AWS のライフサイクル告知は、マネージドサービスの依存関係も所有する移行作業に変えます。利用状況、期限、担当者、代替案を記録し、読み取り専用の検証、限定トラフィック、明示的なロールバック条件の順に進めます。",
        ],
      },
    ],
  },
  "weekly-it-brief-2026-09-07": {
    title: "週刊 IT ブリーフ — より強い道具の境界を製品にする",
    excerpt:
      "エージェントの権限、Apple silicon への移行、より安全なクラウド運用を、明示的な境界から整理します。",
    intro:
      "今週の焦点は機能の一覧ではありません。道具が強くなるほど、権限、互換性、運用上の制限を見える製品契約にする必要があります。",
    sections: [
      {
        heading: "明示すべき三つの境界",
        paragraphs: [
          "強力なツール利用を含むモデル変更は、権限変更でもあります。読み取り、書き込み、外部送信を分け、削除、配布、支払いのように戻しにくい操作には人の確認を残します。",
          "Apple の Rosetta の予定により、出荷するアーキテクチャはリリース上の課題になります。Apple silicon でインストール、起動、更新を確認し、Intel 専用のフレームワーク、プラグイン、補助実行ファイルには担当者と交換日を付けます。",
          "S3 PowerShell Drive はオブジェクト操作をファイル操作のように扱えますが、有効な AWS 認証情報を引き継ぎます。範囲を絞ったプロファイルを使い、非本番環境でバケットとプレフィックスを確認し、書き込みと削除の監査証跡を残します。",
        ],
      },
    ],
  },
  "weekly-it-brief-2026-09-14": {
    title: "週刊 IT ブリーフ — 短くなったリリース周期に運用を合わせる",
    excerpt:
      "Chrome の2週間リリース、GitHub Actions の明確な統制、AWS Quick の常時稼働エージェントを開発者の視点で整理します。",
    intro:
      "今週の要点は、機能が増えることだけではありません。ブラウザー、CI、バックグラウンドのエージェントまで、変更を見つけて統制する間隔が短くなっています。",
    sections: [
      {
        heading: "引き締めるべき三つの運用リズム",
        paragraphs: [
          "Chrome 153 から Stable は2週間周期になり、次の Stable 前に Chrome 154 Beta を試せます。各移行後に重要な導線を Stable と Beta で実行し、管理対象顧客の Extended Stable の節目は別に扱います。",
          "GitHub Actions は runner バージョンの終了予定、読み取り専用の vulnerability-alerts 権限、再利用ワークフローの定義元を示す情報を追加しました。runner を棚卸しし、最小のトークン権限を与え、配布記録には workflow SHA とファイルパスを残します。",
          "Amazon Quick の予約・監視エージェントは、ノート PC を閉じても動き続けます。恒常的なタスクごとに所有者、読むデータの範囲、受信者、保存期間、失敗通知を定め、権限を広げる前に運用できる状態にします。",
        ],
      },
    ],
  },
  "prompt-log-001-arlequin-lumen": {
    title: "Prompt Footage 001 — Arlequin と Lumen が生まれた対話",
    excerpt:
      "個人ポートフォリオの依頼が、協働の原則、視覚システム、制作過程を開く記録へ発展した過程。",
    intro:
      "これはサイトを形づくった対話の公開編集版です。重要なプロンプトと判断を残しつつ、システム指示、個人情報、ローカル環境の詳細は除いています。",
    sections: [
      {
        heading: "ポートフォリオから協働へ",
        paragraphs: [
          "出発点は GitHub 中心のポートフォリオと技術記事でした。次に AI との制作過程そのものを最初の物語とし、各記事に短い状態ラベルを添えることを決めました。",
          "Arlequin は方向を決める人、Lumen は選択肢と文脈を照らす AI です。コーラルとシアンのダイヤ、そしてゴールドの光がその対話を視覚化します。",
        ],
      },
    ],
  },
  "patch-notes-001-portfolio-renewal": {
    title: "Patch Notes 001 — 汎用テンプレートから Arlequin × Lumen へ",
    excerpt:
      "v1.1.2 テンプレートを静的ポートフォリオ、多言語の読書空間、透明な AI 協働アーカイブへ変えた最初の記録。",
    intro:
      "目的は、広い製品テンプレートを今必要な公開面、つまりプロジェクト、文章、その背後の判断へ絞り込むことでした。",
    sections: [
      {
        heading: "変更点",
        paragraphs: [
          "静的配布、GitHub 中心のケーススタディ、MDX 記事、状態ラベル、週刊ブリーフ、そしてプロンプトとパッチを残す Backstage を追加しました。",
          "Arlequin × Lumen のデザインは、画面、記事方針、共有画像をつなぎます。今後も意図、見える変化、根拠、残る制約を記録します。",
        ],
      },
    ],
  },
  "frontend-issues-2025-create-react-app-sunset": editorialArticle(
    "2025 フロントエンド issue 01 — Create React App の終了が残した問い",
    "Create React App を新規利用しないという React チームの勧告を、ランタイム選択と運用責任から読み解きます。",
    "React が終わったのではなく、出発点が変わりました。レンダリング、ルーティング、配布の境界を説明できる選択が必要です。",
    "必要なランタイムだけを選ぶ",
    [
      "小さな静的サイトには Vite と静的ホスティングで十分ですが、データやサーバー処理にはフレームワークが適します。重要なのは名前ではなく境界です。",
      "既存 CRA は急いで作り直す前に、ビルド、テスト、環境変数、配布を文書化します。",
    ],
  ),
  "frontend-issues-2025-react-compiler": editorialArticle(
    "2025 フロントエンド issue 02 — React Compiler が消さないコスト",
    "React Compiler 1.0 が手動メモ化を減らしても、プロファイリングとコンポーネント境界はチームの責任です。",
    "自動最適化は読みやすいレンダリングを速くするときに役立ちますが、データ経路やネットワーク設計は直しません。",
    "導入前後を測る",
    [
      "リンターと小さな opt-in 範囲から導入し、同じ操作のトレースを比較します。",
      "性能が落ちたら手動メモ化を増やす前に責任とデータの流れを見直します。",
    ],
  ),
  "frontend-issues-2025-react-19-2": editorialArticle(
    "2025 フロントエンド issue 03 — React 19.2 と画面のライフサイクル",
    "Activity、useEffectEvent、Performance Tracks が UI の状態と計測を明確にします。",
    "React 19.2 は、消えた画面と一時的に隠れた画面を区別することを促します。",
    "ライフサイクルを分類する",
    [
      "Activity の前に隠れた画面のメモリとアクセシビリティを確認します。effect は同期かユーザーイベントかを分類します。",
      "新 API は状態を保ち、ユーザーが感じる性能を測れるときに価値があります。",
    ],
  ),
  "typescript-issues-2025-5-8": editorialArticle(
    "2025 TypeScript issue 01 — 5.8 が示すランタイム文法",
    "TypeScript 5.8 の戻り値検査と import attributes を、モジュールランタイムと結びつけて説明します。",
    "条件付き return の意図をより正確に検査し、JSON import は assertion から attribute へ向かいます。",
    "ランタイム境界をテストする",
    [
      "キャッシュやユーティリティを新コンパイラで検査し、JSON import を bundler と Node の両方で実行します。",
      "TypeScript の更新は ESM と CJS の契約変更でもあるため、同時に記録します。",
    ],
  ),
  "typescript-issues-2025-5-9": editorialArticle(
    "2025 TypeScript issue 02 — 人が読める tsconfig",
    "TypeScript 5.9 の簡潔な tsc --init と import defer が設定とモジュールの体験を変えます。",
    "コンパイラ設定はチームの文書です。短い出発点は本当の判断を見えやすくします。",
    "意図的な設定を保つ",
    [
      "生成された設定をそのままコピーせず、現在のビルド・テスト・エディタ経路と比較します。",
      "import defer は初期化順を変えるため、副作用と tree shaking も検証します。",
    ],
  ),
  "frontend-issues-2025-vite-7": editorialArticle(
    "2025 フロントエンド issue 04 — Vite 7 の ESM 移行の現実",
    "Vite 7 は Node の対応範囲、ESM 配布、Baseline を一つのツールチェーン移行にします。",
    "ビルドツールの更新は dev server だけでなくリポジトリ全体の Node 方針を変えます。",
    "ツールチェーンの契約を更新する",
    [
      "先に Node を固定し、CommonJS プラグイン、Vitest、SSR adapter、ブラウザ target をテストします。",
      "Baseline target を変えた後は bundle と実ブラウザの挙動を比較します。",
    ],
  ),
  "frontend-issues-2025-node-24": editorialArticle(
    "2025 フロントエンド issue 05 — 開発サーバーの下の Node.js 24",
    "V8 13.6、npm 11、AsyncContextFrame、URLPattern がフロントエンドのサーバー境界を見せます。",
    "ブラウザだけでなく build server、test runner、prerenderer も Node の契約に依存します。",
    "Current を検証レーンにする",
    [
      "Node 24 をまず CI に入れ、native module とブラウザのインストールまで確認します。",
      "LTS になった時点で本番基準を改めて判断します。",
    ],
  ),
  "frontend-issues-2025-interop": editorialArticle(
    "2025 フロントエンド issue 06 — Interop 2025 とブラウザ選択",
    "Interop 2025 は anchor positioning、View Transition、Navigation API の進歩を共通テストにします。",
    "重要なのは機能の数ではなく、通常の製品経路に置ける時期を共通語で説明できることです。",
    "Baseline をチームの言葉にする",
    [
      "Baseline の状態を社内ブラウザ利用率と並べ、progressive enhancement を明示します。",
      "ネイティブ機能にもキーボード、スクリーンリーダー、モバイルのテストが必要です。",
    ],
  ),
  "frontend-issues-2025-eslint-flat-config": editorialArticle(
    "2025 フロントエンド issue 07 — ESLint flat config は新しいファイル以上の変化",
    "flat config への移行は TypeScript モノレポのルールと ignore の合成方法を変えます。",
    "継承を一行ずつ置き換えるより、どのファイルにどの責任のルールが適用されるかを明示します。",
    "パッケージ境界で移行する",
    [
      "共通 preset の後に TypeScript、React、テストの global を正確な file pattern に置きます。",
      "ESLint 10 の eslintrc 削除を前に、custom plugin の deprecated API を片付けます。",
    ],
  ),
  "frontend-issues-2025-rsc-security": editorialArticle(
    "2025 フロントエンド issue 08 — React Server Components パッチの教訓",
    "RSC の修正は dependency、生成 asset、runtime 検証を一つの運用に結びつけます。",
    "サーバー境界を越えるフロントエンドプロトコルは、本番のセキュリティ面です。",
    "パッチは配布作業である",
    [
      "lockfile、image、function、cache を同じ修正単位で更新し、本番 runtime を確認します。",
      "SBOM、dependency review、サーバー回帰テストを通常のリリースに入れます。",
    ],
  ),
  "typescript-issues-2025-native-roadmap": editorialArticle(
    "2025 TypeScript issue 03 — ネイティブコンパイラのロードマップ",
    "TypeScript 7 の native port は速度を約束しますが、移行の本当の問いは互換性です。",
    "大きなモノレポでは速い checker が反復を変えますが、compiler API と declaration の信頼性が必要です。",
    "自分のリポジトリを測る",
    [
      "現在のボトルネックを測り、native preview は分離した CI で比較します。",
      "型結果と editor integration が一致するまで既存 checker を rollback 経路にします。",
    ],
  ),
  "frontend-issues-2025-webassembly-boundary": editorialArticle(
    "2025 フロントエンド issue 09 — WebAssembly がブラウザにサーバーを連れてくるとき",
    "WebAssembly は計算を offline に移せますが、binary、memory、serialization のコストを追加します。",
    "すべての backend をブラウザに移すのではなく、一つの作業から始めるのが検証しやすい選択です。",
    "実行境界を明示する",
    [
      "cached module を versioning し、JS と Wasm の serialization を測り、server fallback を残します。",
      "文書変換、検索、画像処理のように計算境界が明確な仕事から始めます。",
    ],
  ),
  "frontend-issues-2025-interop-ui": editorialArticle(
    "2025 フロントエンド issue 10 — ネイティブ UI が再び設計ツールになる",
    "Popover、customizable select、anchor positioning は design system の JavaScript を減らせます。",
    "ブラウザが focus、dismiss、position を担えば、design system は製品の style と motion に集中できます。",
    "一つの primitive から移す",
    [
      "対応ブラウザを確認し、一つの menu や select を native 経路へ移して比較します。",
      "wrapper component のキーボード、スクリーンリーダー、モバイル動作を検証します。",
    ],
  ),
  "typescript-issues-2026-6-transition": editorialArticle(
    "2026 TypeScript issue 04 — TypeScript 6.0 は移行リリース",
    "TypeScript 6.0 は native compiler に向けて設定の負債を見えるようにします。",
    "慣れた言語知識を保ちつつ、古い default と deprecated option を明らかにするリリースです。",
    "警告を移行作業に変える",
    [
      "baseUrl、node10 resolution、ES5 target、tsconfig と file 引数を検索します。",
      "ignoreDeprecations は一時的な橋であり、最終設定ではありません。",
    ],
  ),
  "typescript-issues-2026-7-native": editorialArticle(
    "2026 TypeScript issue 05 — 10 倍速い TypeScript という数字",
    "TypeScript 7 の native port は一つの benchmark ではなく互換性 matrix で評価します。",
    "速度は重要ですが、型や declaration が予想外に変わる高速ツールは安全な更新ではありません。",
    "時間と結果を比較する",
    [
      "native compiler を別 job で動かし、型、declaration、compiler API、editor plugin を比較します。",
      "editor が新 language service を試しても build は再現可能な version に固定します。",
    ],
  ),
  "frontend-issues-2026-next-adapters": editorialArticle(
    "2026 フロントエンド issue 11 — Next.js Adapter API と配布契約",
    "Next.js 16.2 の stable Adapter API は framework と host の配布結果を versioned contract にします。",
    "adapter は差を消すのではなく、routing、prerender、cache、runtime target を検証可能にします。",
    "adapter output をテストする",
    [
      "static と server の経路を分け、route fixture、header、cache、streaming を比較します。",
      "目的は差を隠すことではなく、差を戻せる形で検証することです。",
    ],
  ),
  "frontend-issues-2026-next-agent-ready": editorialArticle(
    "2026 フロントエンド issue 12 — agent が読んで直せる Next.js",
    "AGENTS.md、browser log forwarding、MCP、actionable error が開発環境を agent interface にします。",
    "agent は見えないものを直せません。versioned docs と structured error は人にも再現可能な入力を提供します。",
    "agent に境界のある契約を与える",
    [
      "command、file boundary、secret rule、approval point を書いてから write access を与えます。",
      "read、write、deploy の権限を分け、merge は人が決めます。",
    ],
  ),
  "frontend-issues-2026-next-security": editorialArticle(
    "2026 フロントエンド issue 13 — 月次 security release がリズムを変える",
    "Next.js の定期的な security process は framework patch を継続的な責任にします。",
    "修正された package は lockfile、runtime、生成 asset、cache が同じ version を配布して初めて役立ちます。",
    "配布された artifact を確認する",
    [
      "security PR を feature から分け、実際の RSC response、header、asset を smoke test します。",
      "rollback artifact と data migration を分離します。",
    ],
  ),
  "frontend-issues-2026-node-26-temporal": editorialArticle(
    "2026 フロントエンド issue 14 — Temporal と時間の境界",
    "Node.js 26 の Temporal は Date、SSR、JSON contract の古い前提を見せます。",
    "精密な time type は有用ですが、browser support、timezone、serialization は製品契約のままです。",
    "instant と display time を分ける",
    [
      "時間が重要な domain から Temporal を使い、UTC instant と表示 zone を分離します。",
      "Date を一括置換する前に hydration と API serialization をテストします。",
    ],
  ),
  "frontend-issues-2026-vite-8-rolldown": editorialArticle(
    "2026 フロントエンド issue 15 — Vite 8 と bundler の再編",
    "Vite 8 の Rolldown 方向は build を速くする一方、plugin と source map の契約を動かします。",
    "bundler の移行は elapsed time だけでなく再現可能な output と debugging quality で判断します。",
    "bundler の変更を隔離する",
    [
      "公式と社内 plugin を最小 fixture で検証し、asset hash、CSS order、stack trace を比較します。",
      "browser target と framework update は別 PR にします。",
    ],
  ),
  "frontend-issues-2026-react-foundation": editorialArticle(
    "2026 フロントエンド issue 16 — React Foundation の governance",
    "React Foundation は ecosystem の保守、release policy、互換性を技術会話の中心に置きます。",
    "foundation は未来を保証しませんが、依存する team に変更の道筋を見せます。",
    "保守経路を記録する",
    [
      "誰が作ったかだけでなく、誰が review し、変更をどう提案し、breaking change をどう告知するかを書きます。",
      "実験が速くても内部 component は安定した公開契約の後ろに置きます。",
    ],
  ),
  "frontend-issues-2026-rsc-security-followup": editorialArticle(
    "2026 フロントエンド issue 17 — RSC follow-up patch を記憶する",
    "RSC の DoS と source exposure の続報は、一つの security patch に記録が必要なことを示します。",
    "security response は affected version の確認、patch、redeploy、検証、記録の連続です。",
    "次の incident を安くする",
    [
      "function、container、CDN asset を一つの release unit として置き換え、確認 URL と version を残します。",
      "短い incident note が最初の担当者なしでも対応できる知識になります。",
    ],
  ),
  "frontend-issues-2026-agent-first-docs": editorialArticle(
    "2026 フロントエンド issue 18 — 文書が agent の最初の interface になるとき",
    "AGENTS.md と Markdown endpoint は、人と agent が framework を推測せず使うための道具です。",
    "version に合う説明は assumptions、command、変更 file、failure 後の check を持つ実行可能な context です。",
    "文書をコードの近くに置く",
    [
      "root には共通原則、app には固有 command を置き、secret と個人環境は除外します。",
      "CI が文書の command を実行し、drift を見つけるようにします。",
    ],
  ),
  "frontend-issues-2026-instant-navigation": editorialArticle(
    "2026 フロントエンド issue 19 — Instant Navigation と cache",
    "Next.js 16.3 の instant navigation と partial prefetching は、速い画面の背後の cache boundary を見せます。",
    "すぐ見える shell は、背後の data が freshness と authorization を満たすときにだけ良い体験になります。",
    "二回目の navigation を測る",
    [
      "初回と再訪の TTFB、INP、freshness を低速 mobile network でも比較します。",
      "cookie、tag、revalidation window がどの cache を許すかを記録します。",
    ],
  ),
  "frontend-issues-2026-web-platform-choices": editorialArticle(
    "2026 フロントエンド issue 20 — Baseline を build target に翻訳する",
    "Baseline、bundler target、fallback test を一つの browser support policy にまとめる方法を整理します。",
    "modern browser は正確な要件ではありません。named target と progressive enhancement、利用データが必要です。",
    "support を実行可能にする",
    [
      "browser target を一つの policy に置き、各 CSS、Web API、JavaScript feature に Baseline と fallback を記録します。",
      "default に任せず、四半期ごとに実際の利用率と policy を見直します。",
    ],
  ),
};

const translations = { en: english, ja: japanese } as const;

export function localizePost(
  locale: Locale,
  post: PostSummary,
): LocalizedArticle | undefined {
  if (locale === "ko") return undefined;
  return translations[locale][post.slug];
}
