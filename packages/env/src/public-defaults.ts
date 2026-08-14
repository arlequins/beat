/**
 * `NEXT_PUBLIC_*` fallbacks — no `serverEnv` / `createEnv`.
 * Import from `@arlequins/env/public-defaults` in Next.js client code to avoid pulling server env.
 */
export const DEFAULT_LOCALHOST_WEB_PORT = 43100;
export const DEFAULT_LOCALHOST_API_PORT = 45100;
export const DEFAULT_LOCALHOST_OIDC_PORT = 45556;
export const DEFAULT_LOCALHOST_SITE_URL = `http://localhost:${DEFAULT_LOCALHOST_WEB_PORT}`;
export const DEFAULT_LOCALHOST_API_URL = `http://localhost:${DEFAULT_LOCALHOST_API_PORT}`;
