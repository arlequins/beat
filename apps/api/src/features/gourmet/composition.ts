import type { GourmetPort } from "./application/ports";
import {
  attachGourmetImage,
  createGourmetEntry,
  deleteGourmetEntry,
  getGourmetEntry,
  getGourmetImage,
  getGourmetImageForAdmin,
  gourmetContext,
  gourmetHistory,
  gourmetImageHistory,
  listGourmetEntries,
  removeGourmetImage,
  restoreGourmetEntry,
  restoreGourmetImage,
  updateGourmetEntry,
  updateGourmetImage,
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
    history: gourmetHistory,
    imageHistory: gourmetImageHistory,
    list: listGourmetEntries,
    removeImage: removeGourmetImage,
    restoreImage: restoreGourmetImage,
    restore: restoreGourmetEntry,
    update: updateGourmetEntry,
    updateImage: updateGourmetImage,
    ...overrides,
  };
}
