import { DEFAULT_LOCALHOST_SITE_URL } from "@acme/env/public-defaults";
import { skipEnvValidation } from "@acme/env/skip-validation";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4";

/**
 * Public env for the Next.js client bundle. Do **not** import `serverEnv` here — it runs in the browser
 * and must only use `NEXT_PUBLIC_*` via `process.env` (inlined at build) plus shared defaults from `@acme/env/public-defaults`.
 *
 * The static portfolio requires only its public site URL.
 */
export const env = createEnv({
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {},
  client: {
    NEXT_PUBLIC_SITE_URL: z.preprocess(
      (v) =>
        typeof v === "string" && v.trim().length > 0
          ? v
          : DEFAULT_LOCALHOST_SITE_URL,
      z.url(),
    ),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  skipValidation: skipEnvValidation,
});
