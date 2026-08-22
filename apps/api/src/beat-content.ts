/**
 * Compatibility entry point for the content feature.
 *
 * Delivery code should import from `features/content`; this barrel remains so
 * existing scripts and tests can migrate without a flag day.
 */

export { BeatContentError } from "./features/content/application/errors";
export * from "./features/content/infrastructure/s3-content-repository";
