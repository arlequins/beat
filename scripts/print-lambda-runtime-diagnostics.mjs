import { readFileSync } from "node:fs";

const MAX_EVENTS = 200;
const MAX_MESSAGE_LENGTH = 4_096;

const PEM_PRIVATE_KEY =
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/g;
const SENSITIVE_ASSIGNMENT =
  /((?:BEAT_[A-Z_]*|GITHUB_APP_PRIVATE_KEY|(?:access|refresh|id)[_-]?token|authorization|password|secret|private[_-]?key)\s*(?:=|:)\s*)(?:"(?:\\.|[^"\\])*"|Bearer\s+[^\s,}]+|[^\s,}]+)/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/gi;

export function redactRuntimeDiagnostic(value) {
  return value
    .replace(PEM_PRIVATE_KEY, "[REDACTED PRIVATE KEY]")
    .replace(SENSITIVE_ASSIGNMENT, "$1[REDACTED]")
    .replace(BEARER_TOKEN, "Bearer [REDACTED]");
}

export function formatRuntimeDiagnosticEvents(payload, logGroupName) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("CloudWatch response must be a JSON object");

  const events = Array.isArray(payload.events) ? payload.events : [];
  if (events.length === 0) return [`${logGroupName}: no matching log events`];

  return events.slice(0, MAX_EVENTS).flatMap((event) => {
    if (!event || typeof event !== "object") return [];
    const message = typeof event.message === "string" ? event.message : "";
    const timestamp = typeof event.timestamp === "number" ? event.timestamp : 0;
    const occurredAt = timestamp
      ? new Date(timestamp).toISOString()
      : "unknown";
    const redacted = redactRuntimeDiagnostic(message).slice(
      0,
      MAX_MESSAGE_LENGTH,
    );
    return [`${logGroupName} ${occurredAt} ${redacted}`.trimEnd()];
  });
}

function main() {
  const [logGroupName] = process.argv.slice(2);
  if (!logGroupName)
    throw new Error("Usage: <log-group-name> < CloudWatch JSON");
  const payload = JSON.parse(readFileSync(0, "utf8"));
  for (const line of formatRuntimeDiagnosticEvents(payload, logGroupName))
    console.log(line);
}

if (process.argv[1]?.endsWith("print-lambda-runtime-diagnostics.mjs")) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Unable to format diagnostics",
    );
    process.exitCode = 1;
  }
}
