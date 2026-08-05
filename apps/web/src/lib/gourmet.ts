import { env } from "~/env";

export type GourmetStatus = "draft" | "published" | "deleted";

export type GourmetImage = {
  altText: string;
  byteSize: number;
  id: string;
  prUrl: string;
  publicPath: string;
};

export type GourmetEntry = {
  area: string | null;
  cookingMethods: string[];
  createdAt: string;
  cuisineTags: string[];
  discoveries: string[];
  freeTextNote: string | null;
  id: string;
  images: GourmetImage[];
  ingredients: string[];
  liked: string[];
  menuName: string;
  nutritionTags: string[];
  postMealNotes: string[];
  rating: number;
  restaurantBranch: string | null;
  restaurantName: string;
  revisit: "yes" | "no" | "unknown";
  revision: number;
  slug: string;
  source: "chatgpt" | "manual" | "import";
  status: GourmetStatus;
  summary: string;
  tasteNotes: string[];
  updatedAt: string;
  visitedAt: string | null;
};

export type GourmetList = {
  entries: GourmetEntry[];
  nextPage?: number;
  page: number;
  total: number;
};

export function gourmetApiUrl() {
  return env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
}

export function gourmetDate(entry: GourmetEntry) {
  return entry.visitedAt ?? entry.createdAt.slice(0, 10);
}

export function publicGourmetImage(image: GourmetImage) {
  return image.publicPath;
}
