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

const translations: Record<
  Exclude<Locale, "ko">,
  Record<string, GourmetCopy>
> = {
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
  if (locale === "ko") return entry;
  const copy = translations[locale][entry.slug];
  if (!copy) return entry;
  return { ...entry, ...copy };
}
