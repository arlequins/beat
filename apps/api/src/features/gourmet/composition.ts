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
  listGourmetEntries,
  removeGourmetImage,
  restoreGourmetEntry,
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
    list: listGourmetEntries,
    removeImage: removeGourmetImage,
    restore: restoreGourmetEntry,
    update: updateGourmetEntry,
    updateImage: updateGourmetImage,
    ...overrides,
  };
}
