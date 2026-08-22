import { describe, expect, it } from "vitest";

import { BeatContentError } from "./errors";
import {
  isContentSlug,
  validateContentSlug,
  validateDraftInput,
} from "./validation";

describe("content application validation", () => {
  it("accepts stable MDX slugs and rejects path-like values", () => {
    expect(isContentSlug("weekly-it-brief-2026-08-22")).toBe(true);
    expect(isContentSlug("../secrets")).toBe(false);
    expect(() => validateContentSlug("../secrets")).toThrow(BeatContentError);
  });

  it("keeps draft validation independent from S3 and HTTP", () => {
    expect(() =>
      validateDraftInput({
        source: "---\ntitle: Test\n---\n\nBody",
        title: "Test",
      }),
    ).not.toThrow();
    expect(() => validateDraftInput({ source: "Body", title: "Test" })).toThrow(
      BeatContentError,
    );
  });
});
