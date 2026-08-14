/**
 * Shared Step Functions **Catch** target (one Lambda for all pipelines).
 * Path in `sst.config.ts`; payload fields `batchId` / `stepFunctionsInput`.
 * Alert implementation: `lib/usecases/pipeline-failure/`.
 */
import { serverEnv } from "@arlequins/env";
import type { Handler } from "aws-lambda";

import { createSnsPipelineAlert } from "../../adaptors/sns-pipeline-alert";
import { createPipelineFailureNotifier } from "../../usecases/pipeline-failure";

export type PipelineFailureHandlerEvent = {
  batchId: string;
  /** Catch-branch input from Step Functions (`Error`, `Cause`, …). */
  stepFunctionsInput?: unknown;
};

function requireBatchId(event: PipelineFailureHandlerEvent): string {
  const id = typeof event.batchId === "string" ? event.batchId.trim() : "";
  if (!id) {
    throw new Error(
      "batchId is required in the event (set in sst.config.ts `lambdaInvoke.payload`)",
    );
  }
  return id;
}

export const handler: Handler<PipelineFailureHandlerEvent> = async (event) => {
  const notify = createPipelineFailureNotifier({
    client: createSnsPipelineAlert(),
    topicArn: serverEnv.ALERT_TOPIC_ARN,
  });
  await notify({
    batchId: requireBatchId(event),
    errorEvent: event.stepFunctionsInput ?? event,
  });
};
