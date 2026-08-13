import { describe, expect, it, vi } from "vitest";

import { createPipelineFailureNotifier } from ".";

describe("createPipelineFailureNotifier", () => {
  it("publishes only an allowlisted failure summary", async () => {
    const send = vi.fn().mockResolvedValue({});
    const notify = createPipelineFailureNotifier({
      client: { send },
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

    expect(send).toHaveBeenCalledOnce();
    const command = send.mock.calls[0]?.[0];
    expect(command.input.TopicArn).toContain("beat-alerts");
    expect(command.input.Message).toContain("States.Timeout");
    expect(command.input.Message).not.toContain("privateToken");
    expect(command.input.Message).not.toContain("do-not-publish");
  });

  it("does not publish when the topic is not configured", async () => {
    const send = vi.fn();
    const notify = createPipelineFailureNotifier({
      client: { send },
      topicArn: "",
    });

    await notify({ batchId: "weekly", errorEvent: { Error: "States.ALL" } });

    expect(send).not.toHaveBeenCalled();
  });
});
