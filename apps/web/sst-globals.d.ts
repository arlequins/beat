/**
 * SST loads real globals from `.sst/platform/config.d.ts` after `pnpm sst:install`.
 * This file keeps `sst.config.ts` typechecking in a fresh clone before that step.
 */

/** Available inside `$config` `run()` — app id from `app()` and active stage (e.g. `pnpm sst deploy --stage`). */
declare const $app: {
  name: string;
  stage: string;
};

type SstAppConfig = {
  name: string;
  removal: string;
  protect: boolean;
  home: string;
  providers?: {
    aws?: { profile?: string; region?: string } | string | boolean;
  };
};

declare const $config: (config: {
  app: (input?: { stage?: string }) => SstAppConfig | Promise<SstAppConfig>;
  run: () =>
    | undefined
    | Record<string, unknown>
    | Promise<undefined | Record<string, unknown>>;
}) => unknown;

declare const sst: {
  aws: {
    StaticSite: new (
      name: string,
      args: {
        path: string;
        errorPage?: string;
        environment?: Record<string, string>;
        build?: { command: string; output: string };
        dev?: { command: string; directory: string; title?: string };
        transform?: {
          assets?: (args: {
            cors?: false;
            enforceHttps?: boolean;
            transform?: Record<string, unknown>;
            versioning?: boolean;
          }) => void;
        };
      },
    ) => {
      url: string;
      nodes: { assets?: { name: string } };
    };
  };
};

declare const aws: {
  s3: {
    BucketOwnershipControls: new (
      name: string,
      args: Record<string, unknown>,
    ) => unknown;
    BucketServerSideEncryptionConfiguration: new (
      name: string,
      args: Record<string, unknown>,
    ) => unknown;
  };
};
