import { serverEnv } from "@acme/env/server-env";

import { recoverBeatStateVersion } from "../src/state-recovery";

const result = await recoverBeatStateVersion({
  sourceKey:
    serverEnv.BEAT_RECOVERY_SOURCE_KEY ??
    (() => {
      throw new Error("BEAT_RECOVERY_SOURCE_KEY is required");
    })(),
  versionId:
    serverEnv.BEAT_RECOVERY_VERSION_ID ??
    (() => {
      throw new Error("BEAT_RECOVERY_VERSION_ID is required");
    })(),
});

console.log(
  JSON.stringify({
    destinationKey: result.destinationKey,
    sourceKey: result.sourceKey,
    status: "recovered-for-review",
  }),
);
