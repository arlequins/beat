export class GourmetError extends Error {
  constructor(
    readonly code:
      | "conflict"
      | "image_invalid"
      | "image_not_found"
      | "invalid"
      | "not_found"
      | "storage_unavailable",
    message: string = code,
  ) {
    super(message);
    this.name = "GourmetError";
  }
}
