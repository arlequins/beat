import type { GourmetPort } from "./application/ports";
import {
  attachGourmetImage,
  createGourmetEntry,
  deleteGourmetEntry,
  getGourmetEntry,
  getGourmetImage,
  getGourmetImageForAdmin,
  gourmetContext,
  listGourmetEntries,
  removeGourmetImage,
  updateGourmetEntry,
} from "./infrastructure/s3-gourmet-repository";

export function createGourmetPort(
  overrides: Partial<GourmetPort> = {},
): GourmetPort {
  return {
    attachImage: attachGourmetImage,
    context: gourmetContext,
    create: createGourmetEntry,
    delete: deleteGourmetEntry,
    get: getGourmetEntry,
    getAdminImage: getGourmetImageForAdmin,
    getImage: getGourmetImage,
    list: listGourmetEntries,
    removeImage: removeGourmetImage,
    update: updateGourmetEntry,
    ...overrides,
  };
}
