import { z } from "zod/v4";

/** Shared with API `post.create` input — keep in sync with DB constraints */
export const createPostInputSchema = z.object({
  title: z.string().trim().min(1).max(256),
  content: z.string().trim().min(1).max(10_000),
});

export type CreatePostInput = z.infer<typeof createPostInputSchema>;

export const updatePostInputSchema = z.object({
  id: z.uuid(),
  data: createPostInputSchema.extend({ version: z.number().int().positive() }),
});

export const listPostsInputSchema = z.object({
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
  query: z.string().max(256).default(""),
  sort: z.enum(["createdAt", "title"]).default("createdAt"),
});

export type ListPostsInput = z.infer<typeof listPostsInputSchema>;
export type UpdatePostInput = z.infer<typeof updatePostInputSchema>;
