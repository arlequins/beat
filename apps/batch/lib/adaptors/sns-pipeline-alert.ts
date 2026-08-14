import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

const snsClient = new SNSClient({});

export function createSnsPipelineAlert() {
  return {
    async publish(input: {
      message: string;
      subject: string;
      topicArn: string;
    }): Promise<void> {
      await snsClient.send(
        new PublishCommand({
          Message: input.message,
          Subject: input.subject,
          TopicArn: input.topicArn,
        }),
      );
    },
  };
}
