import type {
  GourmetEntry,
  GourmetImage,
} from "~/entities/gourmet/model/types";
import { env } from "~/env";

export type {
  GourmetEntry,
  GourmetImage,
  GourmetList,
  GourmetStatus,
} from "~/entities/gourmet/model/types";

export function gourmetApiUrl() {
  return env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
}

export function gourmetDate(entry: GourmetEntry) {
  return entry.visitedAt ?? entry.createdAt.slice(0, 10);
}

export function publicGourmetImage(image: GourmetImage) {
  if (image.publicPath.startsWith("/api/"))
    return `${gourmetApiUrl()}${image.publicPath}`;
  return image.publicPath;
}
