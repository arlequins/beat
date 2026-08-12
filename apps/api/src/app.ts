import { DEFAULT_LOCALHOST_SITE_URL } from "@arlequins/env/public-defaults";
import { serverEnv } from "@arlequins/env/server-env";
import type { ErrorReporter, Logger, Telemetry } from "@arlequins/logger";
import {
  createLogger,
  createTelemetry,
  noopErrorReporter,
} from "@arlequins/logger";
import type { RateLimitPort } from "@arlequins/service";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { createInMemoryRateLimitAdapter } from "./adaptors/in-memory-rate-limit";
import { createS3RateLimitAdapter } from "./adaptors/s3-rate-limit";
import { mapApplicationErrorToHttp } from "./application-error";
import {
  authenticateBeatAdmin,
  type BeatAuthError,
  beatJwks,
  checkBeatStorageReadiness,
  issueBeatAuthorizationCode,
  issueBeatTokenPair,
  redeemBeatAuthorizationCode,
  refreshBeatTokenPair,
  revokeBeatRefreshToken,
  verifyBeatAccessToken,
  verifyBeatIdTokenHint,
} from "./beat-auth";
import {
  type BeatContentError,
  confirmAndPublishBeatDraft,
  getBeatDraft,
  saveBeatDraft,
} from "./beat-content";
import {
  authorizationForm,
  BeatOidcConfigurationError,
  BeatOidcRequestError,
  readStringRecord,
  supportedOidcScopes,
  validateAuthorizationRequest,
  validateLogoutRequest,
} from "./beat-oidc";
import { registerGourmetRoutes } from "./gourmet-routes";
import { registerOpenApiRoutes } from "./openapi";

export type ApiBindings = {
  Variables: {
    logger: Logger;
    requestId: string;
  };
};

export type CreateApiAppOptions = {
  beatAuth?: {
    authenticate: typeof authenticateBeatAdmin;
    issueAuthorizationCode?: typeof issueBeatAuthorizationCode;
    issueTokenPair: typeof issueBeatTokenPair;
    jwks: typeof beatJwks;
    refreshTokenPair: typeof refreshBeatTokenPair;
    redeemAuthorizationCode?: typeof redeemBeatAuthorizationCode;
    verifyIdTokenHint?: typeof verifyBeatIdTokenHint;
    revokeRefreshToken: typeof revokeBeatRefreshToken;
    verifyAccessToken: typeof verifyBeatAccessToken;
  };
  beatContent?: {
    confirmAndPublish: typeof confirmAndPublishBeatDraft;
    getDraft: typeof getBeatDraft;
    saveDraft: typeof saveBeatDraft;
  };
  gourmet?: Parameters<typeof registerGourmetRoutes>[1]["gourmet"];
  gourmetActionApiKey?: string;
  corsOrigins?: string[];
  logger?: Logger;
  readinessCheck?: () => Promise<void>;
  externalReadinessChecks?: Record<string, () => Promise<void>>;
  errorReporter?: ErrorReporter;
  telemetry?: Telemetry;
  bodyLimitBytes?: number;
  beatOidcClientsJson?: string;
  rateLimit?: { requests: number; windowMs: number };
  rateLimiter?: false | RateLimitPort;
};

let coldStart = true;

function configuredCorsOrigins(): string[] {
  const configured = serverEnv.API_CORS_ORIGINS ?? DEFAULT_LOCALHOST_SITE_URL;
  return configured
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function createApiApp(options: CreateApiAppOptions = {}) {
  const app = new OpenAPIHono<ApiBindings>({
    defaultHook(result, context) {
      if (!result.success) {
        return context.json(
          {
            error: "Invalid Request",
            requestId: context.get("requestId"),
          },
          400,
        );
      }
    },
  });
  const corsOrigins = options.corsOrigins ?? configuredCorsOrigins();
  const rootLogger = options.logger ?? createLogger({ service: "api" });
  const readinessCheck = options.readinessCheck ?? checkBeatStorageReadiness;
  const externalChecks = options.externalReadinessChecks ?? {};
  const errorReporter = options.errorReporter ?? noopErrorReporter;
  const telemetry =
    options.telemetry ??
    createTelemetry({ service: "api", metricNamespace: "Template/Api" });
  const stage = process.env.SST_STAGE ?? "local";
  const bodyLimitBytes =
    options.bodyLimitBytes ?? serverEnv.API_BODY_LIMIT_BYTES ?? 1_048_576;
  const rateLimit = options.rateLimit ?? {
    requests: serverEnv.API_RATE_LIMIT_REQUESTS ?? 120,
    windowMs: (serverEnv.API_RATE_LIMIT_WINDOW_SECONDS ?? 60) * 1_000,
  };
  const rateLimiter =
    options.rateLimiter === false
      ? undefined
      : (options.rateLimiter ??
        (serverEnv.BEAT_AUTH_STATE_BUCKET && serverEnv.BEAT_AUTH_LOOKUP_SECRET
          ? createS3RateLimitAdapter()
          : createInMemoryRateLimitAdapter()));
  const beatOidcClientsJson = options.beatOidcClientsJson;
  const auth = {
    authenticate: authenticateBeatAdmin,
    issueAuthorizationCode: issueBeatAuthorizationCode,
    issueTokenPair: issueBeatTokenPair,
    jwks: beatJwks,
    refreshTokenPair: refreshBeatTokenPair,
    redeemAuthorizationCode: redeemBeatAuthorizationCode,
    revokeRefreshToken: revokeBeatRefreshToken,
    verifyAccessToken: verifyBeatAccessToken,
    verifyIdTokenHint: verifyBeatIdTokenHint,
    ...options.beatAuth,
  };
  const content = options.beatContent ?? {
    confirmAndPublish: confirmAndPublishBeatDraft,
    getDraft: getBeatDraft,
    saveDraft: saveBeatDraft,
  };

  app.use("*", requestId());
  app.use("*", async (context, next) => {
    const startedAt = Date.now();
    const logger = rootLogger.child({ requestId: context.get("requestId") });
    context.set("logger", logger);

    await telemetry.trace(
      "http.request",
      { "http.method": context.req.method, "http.route": context.req.path },
      next,
    );

    const durationMs = Date.now() - startedAt;
    logger.info("http.request.completed", {
      durationMs,
      method: context.req.method,
      path: context.req.path,
      status: context.res.status,
    });
    telemetry.metric("RequestCount", 1, "Count", { stage });
    telemetry.metric("RequestDuration", durationMs, "Milliseconds", { stage });
    if (context.res.status >= 500)
      telemetry.metric("ServerErrorCount", 1, "Count", { stage });
    if (context.res.status === 401)
      telemetry.metric("AuthenticationFailure", 1, "Count", { stage });
    if (context.res.status === 409)
      telemetry.metric("ConditionalWriteConflict", 1, "Count", { stage });
    if (coldStart) {
      coldStart = false;
      telemetry.metric("ColdStart", 1, "Count", { stage });
    }
  });
  app.use(
    "*",
    secureHeaders({
      crossOriginResourcePolicy: "same-site",
      permissionsPolicy: {
        camera: [],
        geolocation: [],
        microphone: [],
      },
      referrerPolicy: "no-referrer",
    }),
  );
  app.use(
    "*",
    cors({
      origin: corsOrigins,
      allowHeaders: [
        "Authorization",
        "Content-Type",
        "Trpc-Accept",
        "X-Request-Id",
      ],
      allowMethods: ["DELETE", "GET", "PATCH", "POST", "PUT", "OPTIONS"],
      exposeHeaders: [
        "RateLimit-Limit",
        "RateLimit-Remaining",
        "RateLimit-Reset",
        "Retry-After",
        "X-Request-Id",
      ],
      maxAge: 86_400,
    }),
  );

  const guardedPaths = [
    "/auth/authorize",
    "/auth/login",
    "/auth/token",
    "/auth/refresh",
    "/admin/content/*",
    "/admin/gourmet/*",
    "/api/gourmet/*",
  ];
  for (const path of guardedPaths) {
    app.use(
      path,
      bodyLimit({
        maxSize: bodyLimitBytes,
        onError: (context) =>
          context.json(
            {
              error: "Payload Too Large",
              requestId: context.get("requestId"),
            },
            413,
          ),
      }),
    );
    app.use(path, async (context, next) => {
      if (!rateLimiter || context.req.method === "OPTIONS") return next();
      const forwardedFor = context.req.header("x-forwarded-for") ?? "local";
      const clientKey = forwardedFor.split(",")[0]?.trim() || "unknown";
      const decision = await rateLimiter.consume({
        key: clientKey,
        limit: rateLimit.requests,
        now: new Date(),
        windowMs: rateLimit.windowMs,
      });
      context.header("RateLimit-Limit", String(decision.limit));
      context.header("RateLimit-Remaining", String(decision.remaining));
      context.header(
        "RateLimit-Reset",
        String(Math.ceil(decision.resetAt.getTime() / 1_000)),
      );
      if (!decision.allowed) {
        const retryAfter = Math.max(
          1,
          Math.ceil((decision.resetAt.getTime() - Date.now()) / 1_000),
        );
        context.header("Retry-After", String(retryAfter));
        context.get("logger").warn("http.rate_limit.exceeded");
        telemetry.metric("RateLimitExceeded", 1, "Count", { stage });
        return context.json(
          {
            error: "Too Many Requests",
            requestId: context.get("requestId"),
          },
          429,
        );
      }
      return next();
    });
  }

  registerOpenApiRoutes(app, {
    externalReadinessChecks: externalChecks,
    readinessCheck,
  });

  const parseAuthRequest = async (context: Context<ApiBindings>) => {
    const contentType = context.req.header("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded"))
      return readStringRecord(await context.req.parseBody());
    return readStringRecord(await context.req.json<Record<string, unknown>>());
  };
  const oauthRequestError = (
    context: Context<ApiBindings>,
    error: unknown,
    status: 400 | 503 = 400,
  ) => {
    if (error instanceof BeatOidcConfigurationError)
      return context.json({ error: "temporarily_unavailable" }, 503);
    if (error instanceof BeatOidcRequestError)
      return context.json({ error: error.code }, status);
    throw error;
  };
  const authorizeErrorRedirect = (
    context: Context<ApiBindings>,
    request: ReturnType<typeof validateAuthorizationRequest>,
    error = "access_denied",
  ) => {
    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set("error", error);
    redirect.searchParams.set("state", request.state);
    context.header("Cache-Control", "no-store");
    return context.redirect(redirect.toString(), 302);
  };

  app.get("/auth/.well-known/openid-configuration", (context) => {
    const issuer = serverEnv.BEAT_AUTH_ISSUER_URL?.replace(/\/$/, "");
    if (!issuer)
      return context.json({ error: "Authentication is not configured" }, 503);
    context.header("Cache-Control", "public, max-age=300");
    return context.json({
      authorization_endpoint: `${issuer}/authorize`,
      code_challenge_methods_supported: ["S256"],
      end_session_endpoint: `${issuer}/logout`,
      grant_types_supported: ["authorization_code", "refresh_token"],
      id_token_signing_alg_values_supported: ["ES256"],
      issuer,
      jwks_uri: `${issuer}/jwks`,
      response_types_supported: ["code"],
      revocation_endpoint: `${issuer}/revoke`,
      scopes_supported: supportedOidcScopes,
      subject_types_supported: ["public"],
      token_endpoint: `${issuer}/token`,
      token_endpoint_auth_methods_supported: ["none"],
    });
  });
  app.get("/auth/jwks", async (context) => {
    context.header("Cache-Control", "public, max-age=300");
    return context.json(await auth.jwks());
  });
  app.get("/auth/authorize", (context) => {
    try {
      const request = validateAuthorizationRequest(
        Object.fromEntries(new URL(context.req.url).searchParams.entries()),
        beatOidcClientsJson,
      );
      context.header("Cache-Control", "no-store");
      context.header(
        "Content-Security-Policy",
        "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; style-src 'unsafe-inline'",
      );
      return context.html(authorizationForm(request));
    } catch (error) {
      return oauthRequestError(context, error);
    }
  });
  app.post("/auth/authorize", async (context) => {
    let body: Record<string, unknown>;
    try {
      body = await parseAuthRequest(context);
    } catch (error) {
      return oauthRequestError(context, error);
    }
    let request: ReturnType<typeof validateAuthorizationRequest>;
    try {
      request = validateAuthorizationRequest(body, beatOidcClientsJson);
    } catch (error) {
      return oauthRequestError(context, error);
    }
    const email = typeof body.email === "string" ? body.email : undefined;
    const password =
      typeof body.password === "string" ? body.password : undefined;
    if (!email || !password) return authorizeErrorRedirect(context, request);
    const administrator = await auth.authenticate(email, password);
    if (!administrator) return authorizeErrorRedirect(context, request);
    const code = await (
      auth.issueAuthorizationCode ?? issueBeatAuthorizationCode
    )(administrator, {
      clientId: request.clientId,
      codeChallenge: request.codeChallenge,
      codeChallengeMethod: request.codeChallengeMethod,
      nonce: request.nonce,
      redirectUri: request.redirectUri,
      scope: request.scope,
    });
    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set("code", code);
    redirect.searchParams.set("state", request.state);
    context.header("Cache-Control", "no-store");
    return context.redirect(redirect.toString(), 302);
  });
  app.post("/auth/login", async (context) => {
    const body = await context.req.json<{
      email?: string;
      password?: string;
    }>();
    if (!body.email || !body.password)
      return context.json({ error: "Invalid credentials" }, 400);
    const administrator = await auth.authenticate(body.email, body.password);
    if (!administrator)
      return context.json({ error: "Invalid credentials" }, 401);
    context.header("Cache-Control", "no-store");
    return context.json(await auth.issueTokenPair(administrator));
  });
  const refreshHandler = async (context: Context<ApiBindings>) => {
    const body = await parseAuthRequest(context);
    const grantType =
      typeof body.grant_type === "string" ? body.grant_type : "refresh_token";
    if (grantType === "authorization_code") {
      const code = typeof body.code === "string" ? body.code : undefined;
      const clientId =
        typeof body.client_id === "string" ? body.client_id : undefined;
      const redirectUri =
        typeof body.redirect_uri === "string" ? body.redirect_uri : undefined;
      const codeVerifier =
        typeof body.code_verifier === "string" ? body.code_verifier : undefined;
      if (!code || !clientId || !redirectUri || !codeVerifier)
        return context.json({ error: "invalid_request" }, 400);
      try {
        const tokens = await (
          auth.redeemAuthorizationCode ?? redeemBeatAuthorizationCode
        )({
          clientId,
          code,
          codeVerifier,
          redirectUri,
        });
        context.header("Cache-Control", "no-store");
        return context.json(tokens);
      } catch (error) {
        const authError = error as BeatAuthError;
        if (authError.code === "invalid_authorization_code")
          return context.json({ error: "invalid_grant" }, 400);
        throw error;
      }
    }
    const refreshToken =
      typeof body.refresh_token === "string" ? body.refresh_token : undefined;
    if (grantType !== "refresh_token" || !refreshToken)
      return context.json({ error: "invalid_request" }, 400);
    try {
      const tokens = await auth.refreshTokenPair(refreshToken);
      context.header("Cache-Control", "no-store");
      return context.json(tokens);
    } catch (error) {
      const authError = error as BeatAuthError;
      if (authError.code === "invalid_refresh_token")
        return context.json({ error: "invalid_grant" }, 400);
      throw error;
    }
  };
  app.post("/auth/token", refreshHandler);
  app.post("/auth/refresh", refreshHandler);
  const logoutHandler = async (context: Context<ApiBindings>) => {
    try {
      const input =
        context.req.method === "GET"
          ? Object.fromEntries(new URL(context.req.url).searchParams.entries())
          : await parseAuthRequest(context);
      if (typeof input.id_token_hint === "string") {
        let hint: { clientId: string; subject: string };
        try {
          hint = await (auth.verifyIdTokenHint ?? verifyBeatIdTokenHint)(
            input.id_token_hint,
          );
        } catch {
          throw new BeatOidcRequestError("invalid_request");
        }
        if (input.client_id !== undefined && input.client_id !== hint.clientId)
          throw new BeatOidcRequestError("invalid_request");
        input.client_id = hint.clientId;
      }
      const request = validateLogoutRequest(input, beatOidcClientsJson);
      context.header("Cache-Control", "no-store");
      if (!request.postLogoutRedirectUri) return context.body(null, 204);
      const redirect = new URL(request.postLogoutRedirectUri);
      if (request.state) redirect.searchParams.set("state", request.state);
      return context.redirect(redirect.toString(), 302);
    } catch (error) {
      return oauthRequestError(context, error);
    }
  };
  app.get("/auth/logout", logoutHandler);
  app.post("/auth/logout", logoutHandler);
  app.post("/auth/revoke", async (context) => {
    const body = await parseAuthRequest(context);
    const token =
      typeof body.token === "string"
        ? body.token
        : typeof body.refresh_token === "string"
          ? body.refresh_token
          : undefined;
    if (token) await auth.revokeRefreshToken(token);
    context.header("Cache-Control", "no-store");
    return context.body(null, 200);
  });

  const authenticatedAdministrator = async (context: Context<ApiBindings>) => {
    const authorization = context.req.header("authorization");
    const match = authorization
      ? /^Bearer\s+(\S+)$/i.exec(authorization.trim())
      : undefined;
    if (!match?.[1]) return undefined;
    try {
      return await auth.verifyAccessToken(match[1]);
    } catch {
      return undefined;
    }
  };
  registerGourmetRoutes(app, {
    actionApiKey: options.gourmetActionApiKey,
    gourmet: options.gourmet,
    verifyAccessToken: auth.verifyAccessToken,
  });
  const contentError = (
    context: Context<ApiBindings>,
    error: unknown,
  ): Response | undefined => {
    const code = (error as BeatContentError).code;
    if (code === "invalid_draft")
      return context.json({ error: "Invalid draft" }, 400);
    if (code === "not_found")
      return context.json({ error: "Draft not found" }, 404);
    if (code === "conflict")
      return context.json({ error: "Draft revision conflict" }, 409);
    return undefined;
  };
  app.get("/admin/content/drafts/:slug", async (context) => {
    const administrator = await authenticatedAdministrator(context);
    if (!administrator) return context.json({ error: "Unauthorized" }, 401);
    try {
      const draft = await content.getDraft(context.req.param("slug"));
      return draft
        ? context.json(draft)
        : context.json({ error: "Draft not found" }, 404);
    } catch (error) {
      const response = contentError(context, error);
      if (response) return response;
      throw error;
    }
  });
  app.put("/admin/content/drafts/:slug", async (context) => {
    const administrator = await authenticatedAdministrator(context);
    if (!administrator) return context.json({ error: "Unauthorized" }, 401);
    const body = await context.req.json<{
      expectedRevision?: number;
      source?: string;
      title?: string;
    }>();
    if (
      !Number.isSafeInteger(body.expectedRevision) ||
      typeof body.source !== "string" ||
      typeof body.title !== "string"
    )
      return context.json({ error: "Invalid draft" }, 400);
    try {
      return context.json(
        await content.saveDraft({
          expectedRevision: body.expectedRevision!,
          slug: context.req.param("slug"),
          source: body.source,
          title: body.title,
          updatedBy: administrator.subject,
        }),
      );
    } catch (error) {
      const response = contentError(context, error);
      if (response) return response;
      throw error;
    }
  });
  app.post("/admin/content/drafts/:slug/confirm", async (context) => {
    const administrator = await authenticatedAdministrator(context);
    if (!administrator) return context.json({ error: "Unauthorized" }, 401);
    const body = await context.req.json<{ expectedRevision?: number }>();
    if (!Number.isSafeInteger(body.expectedRevision))
      return context.json({ error: "Invalid draft revision" }, 400);
    try {
      return context.json(
        await content.confirmAndPublish({
          expectedRevision: body.expectedRevision!,
          slug: context.req.param("slug"),
          subject: administrator.subject,
        }),
      );
    } catch (error) {
      const response = contentError(context, error);
      if (response) return response;
      throw error;
    }
  });

  app.notFound((context) =>
    context.json(
      { error: "Not Found", requestId: context.get("requestId") },
      404,
    ),
  );

  app.onError((error, context) => {
    const applicationError = mapApplicationErrorToHttp(error);
    if (applicationError) {
      context.get("logger").warn("http.application-error", {
        code: applicationError.body.error.code,
        error,
      });
      return context.json(
        { ...applicationError.body, requestId: context.get("requestId") },
        applicationError.status,
      );
    }
    context.get("logger").error("http.request.failed", { error });
    void errorReporter.report(error, {
      method: context.req.method,
      path: context.req.path,
      requestId: context.get("requestId"),
    });
    return context.json(
      { error: "Internal Server Error", requestId: context.get("requestId") },
      500,
    );
  });

  return app;
}

export const app = createApiApp();

/** Vercel detects the runtime-independent Hono app at `src/app.ts`. */
export default app;
