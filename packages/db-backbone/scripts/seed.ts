/**
 * Delegates to `runDrizzleSeeds` from `@acme/shared/seed` (runs `seeds/*.ts` beside this file).
 * See `@acme/shared` for ledger schema, ordering, and `stage` from `resolveDeployStage()`.
 */
/// <reference types="node" />
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverEnv } from "@acme/env";
import { runDrizzleSeeds } from "@acme/shared/seed";

import { closeDatabasePool, db } from "../src/client";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const seedDirectories = ["seeds/reference"];
  if (serverEnv.SEED_SAMPLE_DATA) seedDirectories.push("seeds/sample");
  await runDrizzleSeeds({ scriptDir: __dirname, db, seedDirectories });
} finally {
  await closeDatabasePool();
}
