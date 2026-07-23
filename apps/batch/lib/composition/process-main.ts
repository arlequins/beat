import { db } from "@acme/db-backbone/client";
import { createDrizzlePostRepository } from "@acme/db-backbone/post-repository";
import { createLogger } from "@acme/logger";
import { createContentService } from "@acme/service";
import { createProcessMain } from "../usecases/process-main";

const logger = createLogger({
  service: "batch",
  bindings: { component: "process-main" },
});

export const processMain = createProcessMain({
  content: createContentService({
    logger: logger.child({ component: "content-service" }),
    repository: createDrizzlePostRepository(db),
  }),
  logger,
});
