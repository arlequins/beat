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
    const authStateBucket = new sst.aws.Bucket("AuthState", {
      versioning: true,
      lifecycle: [
        {
          expiresIn: "31 days",
          id: "expire-refresh-sessions",
          prefix: "v1/oauth/sessions/",
        },
        {
          expiresIn: "2 days",
          id: "expire-rate-limit-windows",
          prefix: "v1/rate-limit/",
        },
      ],
    });
    const authLedgerBucket = new sst.aws.Bucket("AuthLedger", {
      versioning: true,
      transform: {
        bucket: {
          objectLockEnabled: true,
        },
      },
    });
    const auditEvidenceBucket = new sst.aws.Bucket("AuditEvidence", {
      versioning: true,
    });
    const caller = aws.getCallerIdentityOutput({});
    const trailName = `${$app.name}-${$app.stage}-s3-data`;
    const trailArn = $interpolate`arn:aws:cloudtrail:${region}:${caller.accountId}:trail/${trailName}`;
    const auditEvidencePolicy = aws.iam.getPolicyDocumentOutput({
      statements: [
        {
          actions: ["s3:GetBucketAcl"],
          conditions: [
            {
              test: "StringEquals",
              values: [trailArn],
              variable: "aws:SourceArn",
            },
          ],
          effect: "Allow",
          principals: [
            { identifiers: ["cloudtrail.amazonaws.com"], type: "Service" },
          ],
          resources: [auditEvidenceBucket.arn],
          sid: "CloudTrailAclCheck",
        },
        {
          actions: ["s3:PutObject"],
          conditions: [
            {
              test: "StringEquals",
              values: ["bucket-owner-full-control"],
              variable: "s3:x-amz-acl",
            },
            {
              test: "StringEquals",
              values: [trailArn],
              variable: "aws:SourceArn",
            },
          ],
          effect: "Allow",
          principals: [
            { identifiers: ["cloudtrail.amazonaws.com"], type: "Service" },
          ],
          resources: [
            $interpolate`${auditEvidenceBucket.arn}/AWSLogs/${caller.accountId}/*`,
          ],
          sid: "CloudTrailWrite",
        },
        {
          actions: ["s3:PutObject"],
          conditions: [
            {
              test: "StringEquals",
              values: ["bucket-owner-full-control"],
              variable: "s3:x-amz-acl",
            },
            {
              test: "StringEquals",
              values: [caller.accountId],
              variable: "aws:SourceAccount",
            },
            {
              test: "ArnLike",
              values: [authLedgerBucket.arn],
              variable: "aws:SourceArn",
            },
          ],
          effect: "Allow",
          principals: [{ identifiers: ["s3.amazonaws.com"], type: "Service" }],
          resources: [$interpolate`${auditEvidenceBucket.arn}/inventory/*`],
          sid: "S3InventoryWrite",
        },
        {
          actions: ["s3:*"],
          conditions: [
            {
              test: "Bool",
              values: ["false"],
              variable: "aws:SecureTransport",
            },
          ],
          effect: "Deny",
          principals: [{ identifiers: ["*"], type: "*" }],
          resources: [
            auditEvidenceBucket.arn,
            $interpolate`${auditEvidenceBucket.arn}/*`,
          ],
          sid: "DenyInsecureTransport",
        },
      ],
    });
    const auditEvidenceBucketPolicy = new aws.s3.BucketPolicy(
      "AuditEvidencePolicy",
      {
        bucket: auditEvidenceBucket.name,
        policy: auditEvidencePolicy.json,
      },
    );
    new aws.cloudtrail.Trail(
      "BeatDataTrail",
      {
        enableLogFileValidation: true,
        eventSelectors: [
          {
            dataResources: [
              {
                type: "AWS::S3::Object",
                values: [
                  $interpolate`${authStateBucket.arn}/`,
                  $interpolate`${authLedgerBucket.arn}/`,
                ],
              },
            ],
            includeManagementEvents: false,
            readWriteType: "All",
          },
        ],
        includeGlobalServiceEvents: false,
        isMultiRegionTrail: false,
        name: trailName,
        s3BucketName: auditEvidenceBucket.name,
      },
      { dependsOn: [auditEvidenceBucketPolicy] },
    );
    new aws.s3.Inventory(
      "LedgerInventory",
      {
        bucket: authLedgerBucket.name,
        destination: {
          bucket: {
            accountId: caller.accountId,
            bucketArn: auditEvidenceBucket.arn,
            format: "ORC",
            prefix: "inventory/ledger",
          },
        },
        includedObjectVersions: "All",
        name: `${$app.name}-${$app.stage}-ledger-daily`,
        optionalFields: [
          "ETag",
          "LastModifiedDate",
          "ObjectLockMode",
          "ObjectLockRetainUntilDate",
          "Size",
          "StorageClass",
        ],
        schedule: { frequency: "Daily" },
      },
      { dependsOn: [auditEvidenceBucketPolicy] },
    );
    const cacheBucket = new sst.aws.Bucket("Cache");
    const uploadOrigins = (
      serverEnv.API_CORS_ORIGINS ?? "http://localhost:3000"
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const uploadBucket = new sst.aws.Bucket("Uploads", {
      cors: {
        allowHeaders: ["content-type"],
        allowMethods: ["PUT"],
        allowOrigins: uploadOrigins,
      },
    });
    const handler = {
      handler: "src/lambda.handler",
      link: [cacheBucket, uploadBucket],
      permissions: [
        {
          actions: [
            "s3:GetBucketLocation",
            "s3:ListBucket",
            "s3:ListBucketVersions",
          ],
          resources: [authStateBucket.arn, authLedgerBucket.arn],
        },
        {
          actions: ["s3:GetObject", "s3:PutObject"],
          resources: [$interpolate`${authStateBucket.arn}/*`],
        },
        {
          actions: ["s3:PutObject", "s3:PutObjectRetention"],
          resources: [$interpolate`${authLedgerBucket.arn}/*`],
        },
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
        BEAT_AUTH_STATE_PREFIX: "v1",
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
        link: [],
        timeout: "5 minutes",
      },
    });

    if (deployment.preset === ApiDeploymentPreset.API_GATEWAY) {
      const api = new sst.aws.ApiGatewayV2("Api", {
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
        auditEvidenceBucket: auditEvidenceBucket.name,
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
      auditEvidenceBucket: auditEvidenceBucket.name,
      authLedgerBucket: authLedgerBucket.name,
      authStateBucket: authStateBucket.name,
    };
  },
});
