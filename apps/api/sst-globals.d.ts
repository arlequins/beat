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
  run: () => Record<string, unknown> | Promise<Record<string, unknown>>;
}) => unknown;
declare const $interpolate: (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => string;

declare const sst: {
  aws: {
    ApiGatewayV2: new (
      name: string,
      args: {
        accessLog?: { retention?: string };
        cors?: boolean;
        domain?: string;
        transform?: {
          stage?: (args: {
            defaultRouteSettings?: {
              throttlingBurstLimit?: number;
              throttlingRateLimit?: number;
            };
          }) => void;
        };
      },
    ) => {
      route: (
        route: string,
        handler: {
          handler: string;
          environment?: Record<string, string>;
          link?: unknown[];
          logging?: Record<string, unknown>;
          permissions?: Record<string, unknown>[];
          vpc?: { subnets: string[]; securityGroups: string[] };
        },
      ) => unknown;
      url: string;
    };
    Bucket: new (
      name: string,
      args?: {
        cors?:
          | false
          | {
              allowHeaders?: string[];
              allowMethods?: ("DELETE" | "GET" | "HEAD" | "POST" | "PUT")[];
              allowOrigins?: string[];
            };
        lifecycle?: {
          enabled?: boolean;
          expiresIn?: `${number} day` | `${number} days`;
          id?: string;
          prefix?: string;
        }[];
        enforceHttps?: boolean;
        transform?: Record<string, unknown>;
        versioning?: boolean;
      },
    ) => { arn: string; name: string };
    CronV2: new (
      name: string,
      args: {
        enabled?: boolean;
        function: Record<string, unknown>;
        schedule: string;
      },
    ) => unknown;
    Function: new (
      name: string,
      args: {
        handler: string;
        environment?: Record<string, string>;
        permissions?: Record<string, unknown>[];
        url?:
          | boolean
          | {
              cors?:
                | false
                | {
                    allowCredentials?: boolean;
                    allowHeaders?: readonly string[];
                    allowMethods?: readonly (
                      | "DELETE"
                      | "GET"
                      | "HEAD"
                      | "OPTIONS"
                      | "PATCH"
                      | "POST"
                      | "PUT"
                      | "*"
                    )[];
                    allowOrigins?: readonly string[];
                    exposeHeaders?: readonly string[];
                    maxAge?: string;
                  };
            }
          | { router: { instance: { url: string }; path?: string } };
        vpc?: {
          subnets: string[];
          securityGroups: string[];
        };
        link?: unknown[];
      } & Record<string, unknown>,
    ) => { url: string };
    Router: new (
      name: string,
      args: {
        domain?: string;
        waf?: boolean;
      },
    ) => { url: string };
  };
};

declare const aws: {
  getCallerIdentityOutput: (args?: Record<string, unknown>) => {
    accountId: string;
  };
  cloudtrail: {
    Trail: new (
      name: string,
      args: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => unknown;
  };
  cloudwatch: {
    MetricAlarm: new (
      name: string,
      args: {
        alarmActions?: string[];
        comparisonOperator: string;
        dimensions?: Record<string, string>;
        evaluationPeriods: number;
        metricName: string;
        name?: string;
        namespace: string;
        period: number;
        statistic: string;
        threshold: number;
        treatMissingData?: string;
      },
    ) => unknown;
    Dashboard: new (name: string, args: Record<string, unknown>) => unknown;
  };
  iam: {
    getPolicyDocumentOutput: (args: Record<string, unknown>) => {
      json: string;
    };
  };
  s3: {
    BucketOwnershipControls: new (
      name: string,
      args: Record<string, unknown>,
    ) => unknown;
    BucketServerSideEncryptionConfiguration: new (
      name: string,
      args: Record<string, unknown>,
    ) => unknown;
    BucketPolicy: new (
      name: string,
      args: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => unknown;
    Inventory: new (
      name: string,
      args: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => unknown;
  };
};
