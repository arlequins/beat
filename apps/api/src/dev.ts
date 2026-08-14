import { serverEnv } from "@arlequins/env";
import { DEFAULT_LOCALHOST_API_PORT } from "@arlequins/env/public-defaults";
import { createLogger, startObservability } from "@arlequins/logger";

await startObservability({
  endpoint: serverEnv.OTEL_EXPORTER_OTLP_ENDPOINT,
  environment: serverEnv.SST_STAGE,
  headers: serverEnv.OTEL_EXPORTER_OTLP_HEADERS,
  serviceName: serverEnv.OTEL_SERVICE_NAME ?? "api",
  serviceVersion: serverEnv.OTEL_SERVICE_VERSION,
});

const [{ serve }, { app }] = await Promise.all([
  import("@hono/node-server"),
  import("./app"),
]);

const port = serverEnv.API_PORT ?? DEFAULT_LOCALHOST_API_PORT;
const logger = createLogger({ service: "api" });

serve({ fetch: app.fetch, port }, (info) => {
  logger.info("api.started", { port: info.port });
});
