import { describe, expect, it, vi } from "vitest";

import { createPipelineFailureNotifier } from ".";

describe("createPipelineFailureNotifier", () => {
  it("publishes only an allowlisted failure summary", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const notify = createPipelineFailureNotifier({
      client: { publish },
      topicArn: "arn:aws:sns:ap-northeast-1:123456789012:beat-alerts",
    });

    await notify({
      batchId: "weekly",
      errorEvent: {
        Cause: "secret-bearing cause should not be copied",
        Error: "States.Timeout",
        input: { privateToken: "do-not-publish" },
        stateName: "PublishWeeklyBrief",
      },
    });

    expect(publish).toHaveBeenCalledOnce();
    const message = publish.mock.calls[0]?.[0];
    expect(message.topicArn).toContain("beat-alerts");
    expect(message.message).toContain("States.Timeout");
    expect(message.message).not.toContain("privateToken");
    expect(message.message).not.toContain("do-not-publish");
  });

  it("does not publish when the topic is not configured", async () => {
    const publish = vi.fn();
    const notify = createPipelineFailureNotifier({
      client: { publish },
      topicArn: "",
    });

    await notify({ batchId: "weekly", errorEvent: { Error: "States.ALL" } });

    expect(publish).not.toHaveBeenCalled();
  });
});
