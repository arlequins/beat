/** Called when any pipeline step fails after its configured retries. */
export type PipelineFailurePayload = {
  /** From `lambdaInvoke.payload.batchId` in `sst.config.ts` (one shared failure Lambda). */
  batchId: string;
  /** Step Functions passes error context; shape varies by runtime. */
  errorEvent: unknown;
};

type PipelineFailureAlertClient = {
  publish(input: {
    message: string;
    subject: string;
    topicArn: string;
  }): Promise<void>;
};

type PipelineFailureNotifierOptions = {
  client: PipelineFailureAlertClient;
  topicArn: string | undefined;
};

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
  options: PipelineFailureNotifierOptions,
) {
  return async (payload: PipelineFailurePayload): Promise<void> => {
    const topicArn = options.topicArn;
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
      await options.client.publish({
        message,
        subject: `Beat batch failed: ${payload.batchId}`.slice(0, 100),
        topicArn,
      });
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
