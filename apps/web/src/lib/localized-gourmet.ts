import type { GourmetEntry } from "~/entities/gourmet";
import type { Locale } from "~/lib/i18n";

type GourmetCopy = Partial<
  Pick<
    GourmetEntry,
    | "area"
    | "menuName"
    | "summary"
    | "cuisineTags"
    | "tasteNotes"
    | "liked"
    | "discoveries"
    | "ingredients"
    | "cookingMethods"
    | "freeTextNote"
  >
>;

const translations: Record<Locale, Record<string, GourmetCopy>> = {
  ko: {
    "gourmet-9b882654": {
      area: "도쿄도 신코이와",
      menuName: "특제 닭소바",
      summary: "닭고기와 국물을 함께 맛볼 때 고소한 향이 퍼지는 닭소바입니다.",
      cuisineTags: ["소바", "일본 요리"],
      tasteNotes: ["구운 향", "감칠맛"],
      liked: [
        "닭고기와 국물에서 함께 느껴지는 고소한 향",
        "국물에 고르게 밴 깊은 감칠맛",
      ],
      discoveries: ["메뉴가 많아 무엇을 고를지 고민했습니다."],
      ingredients: ["닭고기", "면"],
    },
    "gourmet-4d7cbe64": {
      area: "도쿄도 가쓰시카구 신코이와역 북쪽",
      menuName: "특제 덴푸라 세이로 소바",
      summary:
        "손으로 뽑은 소바와 바삭하게 튀긴 모둠 튀김을 함께 즐기는 세트입니다. 맷돌로 간 메밀면과 정성껏 튀긴 채소가 든든한 한 끼를 만듭니다.",
      cuisineTags: ["소바", "일본 요리"],
      tasteNotes: ["고소한 메밀 향", "바삭한 튀김"],
      discoveries: [
        "1952년 창업",
        "매장 내 맷돌 제분·제면",
        "메밀가루 80%와 밀가루 20%를 섞어 만드는 소바",
      ],
      ingredients: [
        "메밀",
        "새우",
        "김",
        "꽈리고추",
        "표고버섯",
        "단호박",
        "고구마",
        "가지",
      ],
      cookingMethods: ["수제 소바", "맷돌 제분", "튀김"],
    },
    "gourmet-a29a4189": {
      area: "도쿄도 고토구 시라카와(기요스미시라카와)",
      menuName: "후카가와메시",
      summary:
        "조개의 감칠맛을 밥에 담아낸 도쿄 향토 음식 후카가와메시입니다. 소박한 곁들임 반찬이 국물의 풍미를 돋웁니다.",
      freeTextNote:
        "곁들임 반찬 하나가 네팔 요리처럼 보였지만, 추측일 뿐 확인된 내용은 아닙니다.",
    },
    "gourmet-6090436d": {
      menuName: "마파두부(얼얼함 3·매운맛 2)",
      summary:
        "산초의 얼얼한 향이 살아 있고 매운맛은 적당한 마파두부입니다. 혀를 얼얼하게 하는 풍미가 이 요리의 특징입니다.",
    },
    "gourmet-3f87f9ae": {
      menuName: "튀김 정식",
      summary:
        "갓 튀긴 튀김과 밥을 함께 즐기는 정식입니다. 가벼운 튀김옷 덕분에 부담 없이 먹을 수 있습니다.",
    },
    "gourmet-33c3ce40": {
      menuName: "국내산 돼지 등심 생강구이 정식",
      summary:
        "생강으로 양념한 넉넉한 돼지 등심 정식입니다. 방문 날짜와 일부 세부 정보는 원본 기록에서도 확인되지 않았습니다.",
    },
    "gourmet-d80693ad": {
      menuName: "간장 세이로(이나니와 우동)",
      summary:
        "부드럽고 가는 이나니와 우동을 간장 베이스 소스에 찍어 먹습니다. 섬세한 식감과 기분 좋은 탄력이 돋보입니다.",
    },
  },
  en: {
    "gourmet-9b882654": {
      area: "Shinkoiwa, Tokyo",
      menuName: "Special chicken soba",
      summary:
        "The chicken soba has a pleasant roasted aroma when the chicken and broth are enjoyed together.",
      cuisineTags: ["Soba", "Japanese cuisine"],
      tasteNotes: ["Roasted aroma", "Umami"],
      liked: [
        "The roasted aroma from the chicken and broth together",
        "The rich umami throughout the broth",
      ],
      discoveries: ["The menu has so many choices that it was hard to decide."],
      ingredients: ["Chicken", "Noodles"],
    },
    "gourmet-4d7cbe64": {
      area: "North of Shinkoiwa Station, Katsushika, Tokyo",
      menuName: "Special tempura seiro soba",
      summary:
        "Handmade soba with a crisp assortment of tempura. The stone-milled noodles and carefully fried vegetables make this a satisfying set.",
      cuisineTags: ["Soba", "Japanese cuisine"],
      tasteNotes: ["Nutty buckwheat", "Crisp tempura"],
      ingredients: [
        "Buckwheat",
        "Shrimp",
        "Nori",
        "Green pepper",
        "Shiitake mushroom",
        "Kabocha squash",
        "Sweet potato",
        "Eggplant",
      ],
      cookingMethods: ["Handmade soba", "Stone-milled flour", "Tempura"],
    },
    "gourmet-a29a4189": {
      area: "Shirakawa, Koto, Tokyo (Kiyosumi-Shirakawa)",
      menuName: "Fukagawa rice",
      summary:
        "A generous serving of Fukagawa rice, a local Tokyo dish of rice cooked with clams. The simple sides let the savory broth stand out.",
      freeTextNote:
        "One side seemed reminiscent of a Nepali-style dish, but that was only a guess and remains unconfirmed.",
    },
    "gourmet-6090436d": {
      menuName: "Mapo tofu (numbing spice 3, heat 2)",
      summary:
        "Mapo tofu with a lively Sichuan pepper tingle and moderate heat. The numbing spice is the defining part of the dish.",
    },
    "gourmet-3f87f9ae": {
      menuName: "Tempura set meal",
      summary:
        "A classic tempura set meal with freshly fried pieces and rice. The light batter keeps the meal easy to enjoy.",
    },
    "gourmet-33c3ce40": {
      menuName: "Domestic pork loin ginger set meal",
      summary:
        "A generous pork loin set meal seasoned with ginger. The date and some visit details remain unconfirmed in the source record.",
    },
    "gourmet-d80693ad": {
      menuName: "Soy-sauce seiro (Inaniwa udon)",
      summary:
        "Smooth, thin Inaniwa udon served with a soy-based dipping sauce. The noodles have a refined texture and a satisfying bite.",
    },
  },
  ja: {
    "gourmet-9b882654": {
      area: "東京都・新小岩",
      menuName: "特製鶏そば",
      summary: "鶏肉とスープを一緒に味わうと、香ばしさが広がる鶏そばです。",
      cuisineTags: ["そば", "日本料理"],
      tasteNotes: ["香ばしさ", "うま味"],
      liked: [
        "鶏肉とスープを一緒に味わったときの香ばしさ",
        "スープ全体の豊かなうま味",
      ],
      discoveries: ["メニューが多く、どれを選ぶか迷いました。"],
      ingredients: ["鶏肉", "麺"],
    },
    "gourmet-4d7cbe64": {
      area: "東京都葛飾区・新小岩駅北側",
      menuName: "特製天せいろ",
      summary:
        "手打ちそばと揚げたての天ぷらを楽しめるセット。石臼で挽いたそばと、丁寧に揚げた野菜が印象的でした。",
      cuisineTags: ["そば", "日本料理"],
      tasteNotes: ["そばの香り", "天ぷらの食感"],
      ingredients: [
        "そば",
        "えび",
        "海苔",
        "ししとう",
        "しいたけ",
        "かぼちゃ",
        "さつまいも",
        "なす",
      ],
      cookingMethods: ["手打ちそば", "石臼挽き", "天ぷら"],
    },
    "gourmet-a29a4189": {
      area: "東京都江東区白河（清澄白河）",
      menuName: "深川めし",
      summary:
        "あさりのうま味を炊き込んだ、東京の郷土料理・深川めし。素朴な付け合わせが出汁の風味を引き立てます。",
      freeTextNote:
        "付け合わせの一品はネパール風にも見えましたが、あくまで推測であり、確認は取れていません。",
    },
    "gourmet-6090436d": {
      menuName: "麻婆豆腐（しびれ3・辛さ2）",
      summary:
        "花椒のしびれがしっかり感じられ、辛さはほどよい麻婆豆腐。しびれの風味が料理の印象を決めています。",
    },
    "gourmet-3f87f9ae": {
      menuName: "天ぷら定食",
      summary:
        "揚げたての天ぷらとご飯を味わう定番の定食。軽い衣で食べやすく、落ち着いて楽しめる一食です。",
    },
    "gourmet-33c3ce40": {
      menuName: "国産豚ロースの生姜焼き定食",
      summary:
        "生姜で味付けした国産豚ロースを楽しむ定食。訪問日など一部の情報は、元の記録でも確認できていません。",
    },
    "gourmet-d80693ad": {
      menuName: "醤油せいろ（稲庭うどん）",
      summary:
        "なめらかで細い稲庭うどんを、醤油だれにつけて味わいます。上品な口当たりと心地よい歯ごたえが楽しめます。",
    },
  },
};

export function localizeGourmetEntry(entry: GourmetEntry, locale: Locale) {
  const copy = translations[locale][entry.slug];
  if (!copy) return entry;
  return { ...entry, ...copy };
}
