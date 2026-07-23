/// <reference path="./sst-globals.d.ts" />

/**
 * Bootstrap app: no deployed resources. Aligns AWS provider (profile/region) with web/api.
 * `pnpm env:pull` / `env:push`: Secrets Manager — `pull-secret-env.mjs` / `push-secret-env.mjs` + `scripts/lib/shared.mjs`.
 * Optional: `pnpm --filter @acme/sst-bootstrap sst:install` for SST platform types.
 *
 * SST disallows top-level imports — `app()` loads {@link serverEnv}, {@link sstAwsRegion}, {@link Stage} from `@acme/env` via dynamic import.
 */
export default $config({
  async app(input) {
    const { serverEnv, sstAwsRegion, Stage } = await import("@acme/env");
    const localAwsProfile = serverEnv.SST_AWS_PROFILE?.trim();
    const region = sstAwsRegion();

    return {
      name: "bootstrap",
      removal: input?.stage === Stage.PRODUCTION ? "retain" : "remove",
      protect: input?.stage === Stage.PRODUCTION,
      home: "aws",
      providers: {
        aws: {
          region,
          ...(localAwsProfile ? { profile: localAwsProfile } : {}),
        },
      },
    };
  },
  async run() {
    // No infrastructure — use `pnpm env:pull` for SSM → repo root `.env`.
  },
});
