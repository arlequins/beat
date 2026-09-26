import Image from "next/image";
import { siteAssetPath } from "~/config/site";
import type { Locale } from "~/lib/i18n";

const copy = {
  ko: {
    eyebrow: "Arlequin × Lumen",
    title: "서로 다른 시선, 하나의 작업",
    intro:
      "이 캐릭터들은 사이트의 협업 방식을 그린 상징입니다. 사람은 방향과 공개 기준을 정하고, AI 협업자는 자료와 선택지를 비춰 구현과 검증으로 잇습니다.",
    characters: [
      {
        name: "Arlequin",
        role: "방향을 정하는 사람",
        description:
          "무엇을 만들지 고르고, 무엇을 먼저 할지 결정합니다. 결과의 기준을 세우고, 공개할 준비가 되었는지 최종 판단합니다.",
        visual:
          "코랄 다이아몬드 조각과 떠 있는 가면은 여러 가능성 사이를 오가며 방향을 고르는 역할을 나타냅니다.",
        alt: "떠 있는 상아색 가면과 코랄·남색 다이아몬드 리본으로 이루어진 비인간 무대 캐릭터",
        image: "/characters/arlequin.webp",
      },
      {
        name: "Lumen",
        role: "맥락을 비추는 AI 협업자",
        description:
          "자료를 읽고 서로 다른 단서를 연결합니다. 구현을 실험하고 확인 방법을 마련해, 사람이 더 나은 결정을 내리도록 돕습니다.",
        visual:
          "시안 유리 조각과 금빛 광원은 맥락과 선택지를 비추고 연결하는 역할을 나타냅니다.",
        alt: "금빛 중심광과 궤도에 둘러싸인 시안색 유리 형태의 비인간 캐릭터",
        image: "/characters/lumen.webp",
      },
    ],
  },
  en: {
    eyebrow: "Arlequin × Lumen",
    title: "Different perspectives, shared work",
    intro:
      "These characters are symbolic portraits of how this site is made. The human sets direction and decides what is ready to publish; the AI collaborator illuminates sources and options, then connects them to implementation and checks.",
    characters: [
      {
        name: "Arlequin",
        role: "The human who sets direction",
        description:
          "Chooses what to make and what to do first. Arlequin sets the standard for the result and makes the final call on whether it is ready to share.",
        visual:
          "The coral diamonds and stage mask represent choosing a direction among many possibilities.",
        alt: "A non-human stage figure made from a floating ivory mask and curling coral and navy diamond ribbons",
        image: "/characters/arlequin.webp",
      },
      {
        name: "Lumen",
        role: "The AI collaborator who illuminates context",
        description:
          "Reads sources and connects clues. Lumen experiments with implementation and finds ways to check the result, helping the human make better decisions.",
        visual:
          "Cyan glass facets and a golden light represent illuminating and connecting context and options.",
        alt: "A non-human figure of translucent cyan glass surrounded by orbiting facets and a golden light",
        image: "/characters/lumen.webp",
      },
    ],
  },
  ja: {
    eyebrow: "Arlequin × Lumen",
    title: "異なる視点で、ともにつくる",
    intro:
      "このキャラクターは、サイトづくりにおける協働のあり方を象徴しています。人が方向と公開基準を決め、AI の協働者が資料や選択肢を照らし、実装と確認につなげます。",
    characters: [
      {
        name: "Arlequin",
        role: "方向を決める人",
        description:
          "何をつくるか、何を先に進めるかを選びます。成果の基準を定め、公開できる状態かどうかを最後に判断します。",
        visual:
          "コーラルのダイヤと舞台の仮面は、多くの可能性から方向を選ぶ役割を表します。",
        alt: "浮かぶ象牙色の仮面と、コーラルや紺色のダイヤのリボンでできた非人間の舞台キャラクター",
        image: "/characters/arlequin.webp",
      },
      {
        name: "Lumen",
        role: "文脈を照らす AI の協働者",
        description:
          "資料を読み、異なる手がかりをつなぎます。実装を試し、確認方法を整えて、人がよりよい判断をできるよう支えます。",
        visual:
          "シアンのガラス片と金色の光は、文脈や選択肢を照らし、つなぐ役割を表します。",
        alt: "金色の光と軌道に囲まれた、シアンのガラスでできた非人間のキャラクター",
        image: "/characters/lumen.webp",
      },
    ],
  },
} as const satisfies Record<
  Locale,
  {
    characters: ReadonlyArray<{
      alt: string;
      description: string;
      image: string;
      name: string;
      role: string;
      visual: string;
    }>;
    eyebrow: string;
    intro: string;
    title: string;
  }
>;

export function CharacterGallery({ locale }: { locale: Locale }) {
  const text = copy[locale];

  return (
    <>
      <header className="page-heading character-heading">
        <div className="page-width">
          <p className="brand-eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p>{text.intro}</p>
        </div>
      </header>
      <section aria-label={text.title} className="character-gallery page-width">
        {text.characters.map((character) => (
          <article
            aria-labelledby={`character-${character.name.toLowerCase()}`}
            className="character-card"
            key={character.name}
          >
            <div className="character-portrait">
              <Image
                alt={character.alt}
                height={1402}
                src={siteAssetPath(character.image)}
                unoptimized
                width={1122}
              />
            </div>
            <div className="character-copy">
              <p className="brand-eyebrow">{character.role}</p>
              <h2 id={`character-${character.name.toLowerCase()}`}>
                {character.name}
              </h2>
              <p>{character.description}</p>
              <p className="character-visual">{character.visual}</p>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
