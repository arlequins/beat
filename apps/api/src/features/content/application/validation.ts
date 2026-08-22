import { BeatContentError } from "./errors";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_MDX_BYTES = 256 * 1_024;

export function isContentSlug(slug: string) {
  return SLUG_PATTERN.test(slug);
}

export function validateContentSlug(slug: string) {
  if (!isContentSlug(slug)) throw new BeatContentError("invalid_draft");
  return slug;
}

export function validateDraftInput(input: { source: string; title: string }) {
  if (
    input.title.trim().length < 1 ||
    input.title.length > 200 ||
    !input.source.startsWith("---\n") ||
    new TextEncoder().encode(input.source).byteLength > MAX_MDX_BYTES
  )
    throw new BeatContentError("invalid_draft");
}
