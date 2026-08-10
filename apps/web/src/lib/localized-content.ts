import type { Locale } from "~/lib/i18n";
import type { PostSummary } from "~/lib/posts";

type LocalizedArticle = {
  excerpt: string;
  intro: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
  title: string;
};

const english: Record<string, LocalizedArticle> = {
  "ai-agent-template-workflow": {
    title: "How Arlequin and Lumen build products together",
    excerpt:
      "Arlequin owns direction and standards; Lumen illuminates implementation and verification paths.",
    intro:
      "This portfolio treats Arlequin as the human decision-maker and Lumen as an AI collaborator. The human chooses what matters; the AI turns that decision into experiments, code, documentation, and checks.",
    sections: [
      {
        heading: "A deliberate workflow",
        paragraphs: [
          "We define the problem, divide it into small verifiable changes, implement, and then check types, builds, and the actual interface.",
          "The value is not only speed. The reason behind a choice, the evidence for it, and the next improvement all remain visible.",
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
  "weekly-it-brief-2026-08-10": {
    title: "Weekly IT Brief — When automation changes operations",
    excerpt:
      "A developer's view of CI supply-chain safeguards, cloud lifecycle notices, and long-running agents.",
    intro:
      "This week's operational signal is not simply that automation can do more work. Teams need explicit procedures for pausing, replacing, and observing automated work.",
    sections: [
      {
        heading: "Three operating controls to make explicit",
        paragraphs: [
          "Treat GitHub Actions holds for potentially malicious workflows as a final safeguard, not a substitute for review. Pin actions, require review for workflow changes, and verify the changed YAML, invoked actions, and token scope before approval.",
          "Turn cloud lifecycle notices into a dependency review. Record an owner, replacement, deadline, and rollback plan for each direct or indirect service dependency, then make the result part of release readiness.",
          "For long-running agent work, expose a job ID, progress states, structured logs, time and cost limits, and understandable cancellation and retry paths. Keep idempotency keys and approval points around tool calls with side effects.",
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
          "The initial direction was simple: make a GitHub-centered portfolio with room for technical writing. A later decision made the AI-assisted process itself the first story, with public drafts clearly marked as unreviewed.",
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
          "The portfolio now ships as a static site, with GitHub-centered case studies, MDX writing, public unreviewed drafts, weekly briefs, and a Backstage archive for prompts and patches.",
          "The Arlequin × Lumen design system now links the interface, the writing policy, and the social preview. Future patches will keep recording intent, visible effect, evidence, and remaining constraints.",
        ],
      },
    ],
  },
};

const japanese: Record<string, LocalizedArticle> = {
  "ai-agent-template-workflow": {
    title: "Arlequin と Lumen が製品をつくる方法",
    excerpt:
      "Arlequin が方向と基準を担い、Lumen が実装と検証の可能性を照らします。",
    intro:
      "このポートフォリオでは、人間の意思決定者を Arlequin、AI の協働者を Lumen と呼びます。何を大切にするかは人が決め、AI はその判断を実験、コード、文書、検証へ移します。",
    sections: [
      {
        heading: "意図的なワークフロー",
        paragraphs: [
          "問題を定義し、小さく検証可能な変更に分け、実装した後に型、ビルド、実際の画面を確認します。",
          "価値は速度だけではありません。選択の理由、根拠、次に改善する点を残します。",
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
  "weekly-it-brief-2026-08-10": {
    title: "週刊 IT ブリーフ — 自動化が運用手順を変えるとき",
    excerpt:
      "CI のサプライチェーン防御、クラウドのライフサイクル、長時間実行エージェントを開発者の視点で整理します。",
    intro:
      "今週の運用上のシグナルは、自動化がより多くの仕事を行えることだけではありません。自動化された仕事を止め、置き換え、観察する手順を明確にする必要があります。",
    sections: [
      {
        heading: "明確にしておく三つの運用コントロール",
        paragraphs: [
          "潜在的に悪意のある GitHub Actions ワークフローの保留は、レビューの代わりではなく最後の安全網として扱います。アクションをコミット SHA に固定し、ワークフロー変更のレビューを必須にして、承認前に変更された YAML、呼び出されたアクション、トークンの権限を確認します。",
          "クラウドのライフサイクル告知を依存関係レビューの契機にします。直接・間接の各サービス依存関係について、担当者、代替案、期限、ロールバック計画を記録し、結果をリリース準備の一部にします。",
          "長時間実行するエージェント作業には、ジョブ ID、進捗状態、構造化ログ、時間とコストの上限、理解しやすいキャンセルと再試行の経路を用意します。副作用のあるツール呼び出しには、冪等性キーと承認点を残します。",
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
          "出発点は GitHub 中心のポートフォリオと技術記事でした。次に AI との制作過程そのものを最初の物語とし、未レビューの公開下書きを明確に表示することを決めました。",
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
          "静的配布、GitHub 中心のケーススタディ、MDX 記事、公開未確定原稿、週刊ブリーフ、そしてプロンプトとパッチを残す Backstage を追加しました。",
          "Arlequin × Lumen のデザインは、画面、記事方針、共有画像をつなぎます。今後も意図、見える変化、根拠、残る制約を記録します。",
        ],
      },
    ],
  },
};

const translations = { en: english, ja: japanese } as const;

export function localizePost(
  locale: Locale,
  post: PostSummary,
): LocalizedArticle | undefined {
  if (locale === "ko") return undefined;
  return translations[locale][post.slug];
}
