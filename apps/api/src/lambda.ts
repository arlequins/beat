import { loadBeatRuntimeSecret } from "./runtime-secret";

type RuntimeHandler = (event: unknown, context: unknown) => Promise<unknown>;

let runtime: Promise<RuntimeHandler> | undefined;

async function initialize(): Promise<RuntimeHandler> {
  await loadBeatRuntimeSecret();
  const [{ serverEnv }, { startObservability }, { handle }, { app }] =
    await Promise.all([
      import("@acme/env"),
      import("@acme/logger"),
      import("hono/aws-lambda"),
      import("./app"),
    ]);
  await startObservability({
    endpoint: serverEnv.OTEL_EXPORTER_OTLP_ENDPOINT,
    environment: serverEnv.SST_STAGE,
    headers: serverEnv.OTEL_EXPORTER_OTLP_HEADERS,
    serviceName: serverEnv.OTEL_SERVICE_NAME ?? "api",
    serviceVersion: serverEnv.OTEL_SERVICE_VERSION,
  });
  return handle(app) as RuntimeHandler;
}

export async function handler(event: unknown, context: unknown) {
  if (!runtime) runtime = initialize();
  const active = runtime;
  return (await active)(event, context);
}
