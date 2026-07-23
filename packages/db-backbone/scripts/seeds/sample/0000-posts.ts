import { assertSampleSeedAllowed } from "@acme/shared/seed-safety";
import type { SeedContext } from "@acme/types";

import type { Database } from "../../../src/client";
import { Post } from "../../../src/schema";

type SeedTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export default async function seed({
  tx,
  stage,
}: SeedContext<SeedTx>): Promise<void> {
  assertSampleSeedAllowed(stage, true);
  await tx.insert(Post).values([
    { title: "Seeded post", content: "Hello from pnpm seed" },
    { title: "Second seed", content: "Add more rows here" },
  ]);
}
