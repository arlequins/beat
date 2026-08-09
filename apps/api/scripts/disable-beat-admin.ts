import { serverEnv } from "@acme/env/server-env";

import { disableBeatAdmin } from "../src/beat-auth";
import { requireGitHubProductionAction } from "./require-github-production-action";

requireGitHubProductionAction();

const email = serverEnv.BEAT_ADMIN_BOOTSTRAP_EMAIL;

if (!email) throw new Error("BEAT_ADMIN_BOOTSTRAP_EMAIL is required");

const administrator = await disableBeatAdmin(email);

process.stdout.write(
  `Disabled Beat administrator ${administrator.email} at revision ${administrator.revision}\n`,
);
