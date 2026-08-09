/// <reference path="./sst-globals.d.ts" />

/** Hono API deployed through the endpoint selected by `API_DEPLOYMENT_PRESET`. */
export default $config({
  async app(input) {
    const { serverEnv, sstAwsRegion, Stage } = await import("@acme/env");
    if (
      input?.stage === Stage.PRODUCTION &&
      process.env.GITHUB_ACTIONS !== "true"
    )
      throw new Error(
        "Beat production deployment is allowed only from protected GitHub Actions",
      );
    const localAwsProfile = serverEnv.SST_AWS_PROFILE?.trim();
    const region = sstAwsRegion();

    return {
      name: "api",
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
    const {
      ApiDeploymentPreset,
      LambdaEnvironment,
      resolveApiDeploymentConfig,
      serverEnv,
      sstAwsRegion,
      Stage,
      vpcFromEnv,
    } = await import("@acme/env");

    const region = sstAwsRegion();
    const vpc = vpcFromEnv();
    const deployment = resolveApiDeploymentConfig({
      customDomain: serverEnv.API_CUSTOM_DOMAIN,
      preset: serverEnv.API_DEPLOYMENT_PRESET,
      throttleBurstLimit: serverEnv.API_THROTTLE_BURST_LIMIT,
      throttleRateLimit: serverEnv.API_THROTTLE_RATE_LIMIT,
      wafEnabled: serverEnv.API_WAF_ENABLED,
    });
    if ($app.stage === Stage.PRODUCTION && !serverEnv.BEAT_RUNTIME_SECRET_ARN)
      throw new Error(
        "BEAT_RUNTIME_SECRET_ARN is required for the production API Lambda",
      );

    const statePrefix = serverEnv.BEAT_AUTH_STATE_PREFIX.replace(
      /^\/+|\/+$/g,
      "",
    );
    const createPrivateBucket = (
      name: string,
      options: {
        cors?:
          | false
          | {
              allowHeaders: string[];
              allowMethods: ("PUT" | "GET")[];
              allowOrigins: string[];
            };
        lifecycle?: {
          expiresIn: `${number} day` | `${number} days`;
          id: string;
          prefix: string;
        }[];
        objectLock?: boolean;
      } = {},
    ) => {
      const bucket = new sst.aws.Bucket(name, {
        cors: options.cors ?? false,
        enforceHttps: true,
        lifecycle: options.lifecycle,
        versioning: true,
        transform: {
          bucket: {
            forceDestroy: false,
            ...(options.objectLock ? { objectLockEnabled: true } : {}),
          },
          publicAccessBlock: {
            blockPublicAcls: true,
            blockPublicPolicy: true,
            ignorePublicAcls: true,
            restrictPublicBuckets: true,
          },
        },
      });
      new aws.s3.BucketOwnershipControls(`${name}Ownership`, {
        bucket: bucket.name,
        rule: { objectOwnership: "BucketOwnerEnforced" },
      });
      new aws.s3.BucketServerSideEncryptionConfiguration(`${name}Encryption`, {
        bucket: bucket.name,
        rules: [
          { applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" } },
        ],
      });
      return bucket;
    };

    const authStateBucket = createPrivateBucket("AuthState", {
      lifecycle: [
        {
          expiresIn: "31 days",
          id: "expire-refresh-sessions",
          prefix: `${statePrefix}/oauth/sessions/`,
        },
        {
          expiresIn: "2 days",
          id: "expire-rate-limit-windows",
          prefix: `${statePrefix}/rate-limit/`,
        },
      ],
    });
    const authLedgerBucket = createPrivateBucket("AuthLedger", {
      objectLock: true,
    });
    const cacheBucket = createPrivateBucket("Cache", {
      lifecycle: [
        {
          expiresIn: "7 days",
          id: "expire-cache-objects",
          prefix: `${$app.name}/${$app.stage}/`,
        },
      ],
    });
    const uploadOrigins = (
      serverEnv.API_CORS_ORIGINS ?? "http://localhost:3000"
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const uploadBucket = createPrivateBucket("Uploads", {
      cors: {
        allowHeaders: ["content-type"],
        allowMethods: ["PUT"],
        allowOrigins: uploadOrigins,
      },
      lifecycle: [
        {
          expiresIn: "31 days",
          id: "expire-unpublished-uploads",
          prefix: `${$app.name}/${$app.stage}/`,
        },
      ],
    });
    const handler = {
      handler: "src/lambda.handler",
      logging: {
        format: "json" as const,
        retention: $app.stage === Stage.PRODUCTION ? "13 months" : "1 month",
      },
      permissions: [
        {
          actions: ["s3:GetBucketLocation", "s3:ListBucket"],
          resources: [authStateBucket.arn, authLedgerBucket.arn],
        },
        {
          actions: ["s3:ListBucketVersions"],
          resources: [authStateBucket.arn],
        },
        {
          actions: ["s3:GetObject", "s3:PutObject"],
          resources: [$interpolate`${authStateBucket.arn}/${statePrefix}/*`],
        },
        {
          actions: ["s3:PutObject", "s3:PutObjectRetention"],
          resources: [
            $interpolate`${authLedgerBucket.arn}/${statePrefix}/events/*`,
          ],
        },
        {
          actions: ["s3:ListBucket"],
          conditions: [
            {
              test: "StringLike",
              variable: "s3:prefix",
              values: [
                `${$app.name}/${$app.stage}`,
                `${$app.name}/${$app.stage}/*`,
              ],
            },
          ],
          resources: [cacheBucket.arn],
        },
        {
          actions: ["s3:DeleteObject", "s3:GetObject", "s3:PutObject"],
          resources: [
            $interpolate`${cacheBucket.arn}/${$app.name}/${$app.stage}/*`,
          ],
        },
        {
          actions: ["s3:PutObject"],
          resources: [
            $interpolate`${uploadBucket.arn}/${$app.name}/${$app.stage}/*`,
          ],
        },
        ...(serverEnv.BEAT_RUNTIME_SECRET_ARN
          ? [
              {
                actions: ["secretsmanager:GetSecretValue"],
                resources: [serverEnv.BEAT_RUNTIME_SECRET_ARN],
              },
            ]
          : []),
      ],
      ...(vpc
        ? {
            vpc: {
              subnets: vpc.subnetIds,
              securityGroups: vpc.securityGroups,
            },
          }
        : {}),
      environment: {
        ...LambdaEnvironment,
        BEAT_AUTH_LEDGER_BUCKET: authLedgerBucket.name,
        BEAT_AUTH_LEDGER_RETENTION_DAYS: "365",
        BEAT_AUTH_STATE_BUCKET: authStateBucket.name,
        BEAT_AUTH_STATE_PREFIX: statePrefix,
        ...(serverEnv.BEAT_RUNTIME_SECRET_ARN
          ? { BEAT_RUNTIME_SECRET_ARN: serverEnv.BEAT_RUNTIME_SECRET_ARN }
          : {}),
        S3_CACHE_BUCKET: cacheBucket.name,
        S3_CACHE_PREFIX: `${$app.name}/${$app.stage}`,
        S3_UPLOAD_BUCKET: uploadBucket.name,
        S3_UPLOAD_PREFIX: `${$app.name}/${$app.stage}`,
        SST_STAGE: $app.stage,
      },
    };
    const alarmActions = serverEnv.ALERT_TOPIC_ARN
      ? [serverEnv.ALERT_TOPIC_ARN]
      : [];
    const metric = (name: string) => ({
      namespace: "Template/Api",
      metricName: name,
      dimensions: { stage: $app.stage },
      period: 300,
      statistic: "Sum",
    });
    new aws.cloudwatch.MetricAlarm("ApiServerErrors", {
      ...metric("ServerErrorCount"),
      evaluationPeriods: 1,
      threshold: 1,
      comparisonOperator: "GreaterThanOrEqualToThreshold",
      alarmActions,
    });
    new aws.cloudwatch.MetricAlarm("ApiLatency", {
      ...metric("RequestDuration"),
      statistic: "Average",
      evaluationPeriods: 2,
      threshold: 2_000,
      comparisonOperator: "GreaterThanThreshold",
      alarmActions,
    });
    new aws.cloudwatch.Dashboard("ApiDashboard", {
      dashboardName: `${$app.name}-${$app.stage}`,
      dashboardBody: JSON.stringify({
        widgets: [
          {
            type: "metric",
            width: 12,
            height: 6,
            properties: {
              region,
              title: "API requests, errors, latency, and cold starts",
              metrics: [
                ["Template/Api", "RequestCount", "stage", $app.stage],
                [".", "ServerErrorCount", ".", "."],
                [".", "RequestDuration", ".", ".", { stat: "Average" }],
                [".", "ColdStart", ".", "."],
              ],
            },
          },
        ],
      }),
    });

    const operationalMetric = (name: string) => ({
      namespace: "Beat/Operations",
      metricName: name,
      dimensions: { stage: $app.stage },
      period: 300,
      statistic: "Sum",
    });
    for (const [name, metricName, threshold] of [
      ["ReconciliationFailures", "ReconciliationFailure", 1],
      ["ReconciliationBacklog", "ReconciliationBacklog", 1],
      ["UnexpectedStateDeletes", "UnexpectedDeleteMarker", 1],
    ] as const) {
      new aws.cloudwatch.MetricAlarm(name, {
        ...operationalMetric(metricName),
        alarmActions,
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        evaluationPeriods: 1,
        threshold,
        treatMissingData: "notBreaching",
      });
    }
    for (const [name, metricName, threshold] of [
      ["AuthenticationFailures", "AuthenticationFailure", 5],
      ["ConditionalWriteConflicts", "ConditionalWriteConflict", 5],
    ] as const) {
      new aws.cloudwatch.MetricAlarm(name, {
        ...metric(metricName),
        alarmActions,
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        evaluationPeriods: 1,
        threshold,
        treatMissingData: "notBreaching",
      });
    }

    new sst.aws.CronV2("BeatReconciliation", {
      enabled: $app.stage === Stage.PRODUCTION,
      schedule: "rate(15 minutes)",
      function: {
        ...handler,
        handler: "src/reconcile.handler",
        timeout: "5 minutes",
      },
    });

    if (deployment.preset === ApiDeploymentPreset.API_GATEWAY) {
      const api = new sst.aws.ApiGatewayV2("Api", {
        accessLog: {
          retention: $app.stage === Stage.PRODUCTION ? "13 months" : "1 month",
        },
        cors: false,
        ...(deployment.customDomain ? { domain: deployment.customDomain } : {}),
        transform: {
          stage: (args) => {
            args.defaultRouteSettings = {
              throttlingBurstLimit: deployment.throttleBurstLimit,
              throttlingRateLimit: deployment.throttleRateLimit,
            };
          },
        },
      });

      api.route("$default", handler);

      return {
        apiUrl: api.url,
        authLedgerBucket: authLedgerBucket.name,
        authStateBucket: authStateBucket.name,
      };
    }

    const router = deployment.useEdgeRouter
      ? new sst.aws.Router("ApiRouter", {
          ...(deployment.customDomain
            ? { domain: deployment.customDomain }
            : {}),
          waf: deployment.wafEnabled,
        })
      : undefined;

    const api = new sst.aws.Function("Api", {
      ...handler,
      url: router ? { router: { instance: router } } : true,
    });

    return {
      apiUrl: router?.url ?? api.url,
      authLedgerBucket: authLedgerBucket.name,
      authStateBucket: authStateBucket.name,
    };
  },
});
