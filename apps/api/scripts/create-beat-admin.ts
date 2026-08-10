import { serverEnv } from "@arlequins/env/server-env";

import { createBeatAdmin } from "../src/beat-auth";
import { requireGitHubProductionAction } from "./require-github-production-action";

requireGitHubProductionAction();

const email = serverEnv.BEAT_ADMIN_BOOTSTRAP_EMAIL;
const password = serverEnv.BEAT_ADMIN_BOOTSTRAP_PASSWORD;

if (!email || !password)
  throw new Error(
    "BEAT_ADMIN_BOOTSTRAP_EMAIL and BEAT_ADMIN_BOOTSTRAP_PASSWORD are required",
  );

const administrator = await createBeatAdmin(email, password);

process.stdout.write(
  `Created Beat administrator ${administrator.email} (${administrator.subject})\n`,
);
