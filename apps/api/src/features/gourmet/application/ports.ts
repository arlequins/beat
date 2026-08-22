import type {
  GourmetEntry,
  GourmetImage,
  GourmetInput,
  GourmetListFilter,
  GourmetStatus,
} from "../domain/models";

export type GourmetImageInput = {
  altText: string;
  contentBase64: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  originalFilename: string;
};

export type GourmetImageResponse = {
  body: Uint8Array;
  contentLength?: number;
  contentType: string;
  etag?: string;
  lastModified?: Date;
};

export type GourmetPort = {
  attachImage(
    entryId: string,
    input: GourmetImageInput,
    subject: string,
  ): Promise<GourmetEntry>;
  context(input: { days: number; limit: number }): Promise<unknown>;
  create(
    input: GourmetInput,
    options: {
      idempotencyKey?: string;
      status?: GourmetStatus;
      subject: string;
    },
  ): Promise<GourmetEntry>;
  delete(id: string, subject: string): Promise<GourmetEntry>;
  get(
    idOrSlug: string,
  ): Promise<{ entry: GourmetEntry; etag: string } | undefined>;
  getAdminImage(
    entryId: string,
    imageId: string,
  ): Promise<GourmetImageResponse>;
  getImage(entryId: string, imageId: string): Promise<GourmetImageResponse>;
  list(filter: GourmetListFilter): Promise<{
    entries: GourmetEntry[];
    nextPage?: number;
    page: number;
    total: number;
  }>;
  removeImage(
    entryId: string,
    imageId: string,
    subject: string,
  ): Promise<GourmetEntry>;
  update(
    id: string,
    patch: Partial<GourmetInput> & {
      deletedAt?: string;
      expectedRevision?: number;
      images?: GourmetImage[];
    },
    subject: string,
  ): Promise<GourmetEntry>;
};
