export class BeatContentError extends Error {
  constructor(readonly code: "conflict" | "invalid_draft" | "not_found") {
    super(code);
    this.name = "BeatContentError";
  }
}
