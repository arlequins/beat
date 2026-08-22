export type BeatDraft = {
  revision: number;
  schemaVersion: 1;
  slug: string;
  source: string;
  status: "draft" | "confirmed";
  title: string;
  updatedAt: string;
  updatedBy: string;
};

export type BeatDraftRevisionRecord = Omit<BeatDraft, "source"> & {
  sourceBytes: number;
};

export type BeatContentRecord = {
  category?: string;
  origin: "draft" | "repository";
  publishedAt?: string;
  reviewStatus?: "reviewed" | "unreviewed";
  revision: number;
  slug: string;
  status: "confirmed" | "draft" | "published";
  title: string;
  updatedAt?: string;
};

export type BeatRepositoryPost = {
  origin: "repository";
  revision: 0;
  slug: string;
  source: string;
  status: "draft";
  title: string;
};

export type PublicationJob = {
  branch: string;
  completedAt?: string;
  draftRevision: number;
  idempotencyKey: string;
  prUrl?: string;
  schemaVersion: 1;
  slug: string;
  status: "closed" | "merged" | "opened" | "pending";
  updatedAt: string;
};
