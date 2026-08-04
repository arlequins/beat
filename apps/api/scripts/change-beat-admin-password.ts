import { serverEnv } from "@acme/env/server-env";

import { changeBeatAdminPassword } from "../src/beat-auth";

const email = serverEnv.BEAT_ADMIN_BOOTSTRAP_EMAIL;
const password = serverEnv.BEAT_ADMIN_BOOTSTRAP_PASSWORD;

if (!email || !password)
  throw new Error(
    "BEAT_ADMIN_BOOTSTRAP_EMAIL and BEAT_ADMIN_BOOTSTRAP_PASSWORD are required",
  );

const administrator = await changeBeatAdminPassword(email, password);

process.stdout.write(
  `Changed Beat administrator password for ${administrator.email} at revision ${administrator.revision}\n`,
);
