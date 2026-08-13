import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

/** Called when any pipeline step fails after its configured retries. */
export type PipelineFailurePayload = {
  /** From `lambdaInvoke.payload.batchId` in `sst.config.ts` (one shared failure Lambda). */
  batchId: string;
  /** Step Functions passes error context; shape varies by runtime. */
  errorEvent: unknown;
};

type PipelineFailureAlertClient = {
  send(command: PublishCommand): Promise<unknown>;
};

type PipelineFailureNotifierOptions = {
  client?: PipelineFailureAlertClient;
  topicArn?: string;
};

const snsClient = new SNSClient({});
const safeErrorKeys = [
  "Error",
  "Cause",
  "error",
  "cause",
  "executionArn",
  "stateName",
];

function safeErrorDetails(errorEvent: unknown): Record<string, string> {
  if (!errorEvent || typeof errorEvent !== "object") {
    return { error: String(errorEvent ?? "unknown") };
  }

  const event = errorEvent as Record<string, unknown>;
  return Object.fromEntries(
    safeErrorKeys.flatMap((key) => {
      const value = event[key];
      if (typeof value !== "string" || value.length === 0) return [];
      return [[key, value.slice(0, 1000)]];
    }),
  );
}

export function createPipelineFailureNotifier(
  options: PipelineFailureNotifierOptions = {},
) {
  const client = options.client ?? snsClient;

  return async (payload: PipelineFailurePayload): Promise<void> => {
    const topicArn =
      options.topicArn ??
      (await import("@arlequins/env")).serverEnv.ALERT_TOPIC_ARN;
    const details = safeErrorDetails(payload.errorEvent);
    const message = JSON.stringify({
      service: "beat-batch",
      batchId: payload.batchId,
      ...details,
    });

    if (!topicArn) {
      console.warn(
        "[PipelineFailure] ALERT_TOPIC_ARN is not configured",
        JSON.stringify({ batchId: payload.batchId, ...details }),
      );
      return;
    }

    try {
      await client.send(
        new PublishCommand({
          Message: message,
          Subject: `Beat batch failed: ${payload.batchId}`.slice(0, 100),
          TopicArn: topicArn,
        }),
      );
      console.warn(
        "[PipelineFailure] alert published",
        JSON.stringify({ batchId: payload.batchId }),
      );
    } catch (error) {
      console.error(
        "[PipelineFailure] alert publish failed",
        JSON.stringify({
          batchId: payload.batchId,
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  };
}

export async function notifyPipelineFailureAlert(
  payload: PipelineFailurePayload,
): Promise<void> {
  await createPipelineFailureNotifier()(payload);
}
