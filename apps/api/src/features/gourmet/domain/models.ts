export type GourmetStatus = "draft" | "published" | "deleted";
export type GourmetSource = "chatgpt" | "manual" | "import";
export type Revisit = "yes" | "no" | "unknown";
export type GourmetImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export type GourmetImage = {
  altText: string;
  byteSize: number;
  createdAt: string;
  height: number | null;
  id: string;
  mimeType: GourmetImageMimeType;
  originalFilename: string;
  prUrl?: string;
  publicPath: string;
  repositoryPath?: string;
  sortOrder: number;
  storageKey: string;
  width: number | null;
};

export type GourmetHistoryItem = Pick<
  GourmetEntry,
  | "menuName"
  | "restaurantName"
  | "revision"
  | "status"
  | "updatedAt"
  | "visitedAt"
>;

export type GourmetImageHistoryItem = {
  image: GourmetImage;
  revision: number;
};

export type GourmetEntry = {
  area: string | null;
  cookingMethods: string[];
  createdAt: string;
  cuisineTags: string[];
  deletedAt?: string;
  discoveries: string[];
  externalRequestId: string | null;
  freeTextNote: string | null;
  id: string;
  idempotencyFingerprint?: string;
  images: GourmetImage[];
  ingredients: string[];
  liked: string[];
  menuName: string;
  nutritionTags: string[];
  postMealNotes: string[];
  rating: number;
  restaurantBranch: string | null;
  restaurantName: string;
  revisit: Revisit;
  revision: number;
  schemaVersion: 1;
  slug: string;
  source: GourmetSource;
  status: GourmetStatus;
  summary: string;
  tasteNotes: string[];
  updatedAt: string;
  visitedAt: string | null;
};

export type GourmetInput = Omit<
  GourmetEntry,
  | "createdAt"
  | "deletedAt"
  | "id"
  | "idempotencyFingerprint"
  | "images"
  | "revision"
  | "schemaVersion"
  | "slug"
  | "updatedAt"
>;

export type GourmetListFilter = {
  area?: string;
  cuisineTag?: string;
  from?: string;
  ingredient?: string;
  minRating?: number;
  page?: number;
  pageSize?: number;
  restaurantName?: string;
  revisit?: Revisit;
  status?: GourmetStatus;
  to?: string;
};
