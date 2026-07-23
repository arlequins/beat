/**
 * Batch app wiring: schedule keys, per-stage cron/enabled flags, and the list of manifests
 * consumed by `sst.config.ts`.
 *
 * Step arrays live in `config/step-defs/` and are passed to `createBatchManifest` from `../shared`.
 *
 * @see https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html
 */

import type { DeployStage } from "@acme/env";
import { resolveDeployStage } from "@acme/env";

import type { BatchManifest } from "../shared";
import { createBatchManifest } from "../shared";
import { sampleSteps } from "./step-defs/sample";

export type BatchScheduleId =
  (typeof BatchScheduleId)[keyof typeof BatchScheduleId];

/** Extend when adding a batch: add a row in `ScheduleByStage` for every `DeployStage`. */
export const BatchScheduleId = {
  SAMPLE: "sample",
} as const;

/** Every batch here gets its own Step Functions + Cron + starter Lambda. Order does not matter. */
const stage = resolveDeployStage();

/**
 * Per-stage cron/rate per batch id (`sample`, …). Add a column when you add a batch folder.
 */
export const ScheduleByStage: Record<
  DeployStage,
  Record<BatchScheduleId, { cron: string; enabled: boolean }>
> = {
  production: {
    [BatchScheduleId.SAMPLE]: {
      cron: "cron(0 2 * * ? *)",
      enabled: true,
    },
  },
  develop: {
    [BatchScheduleId.SAMPLE]: {
      cron: "cron(0 2 * * ? *)",
      enabled: true,
    },
  },
  offline: {
    [BatchScheduleId.SAMPLE]: {
      cron: "cron(0 2 * * ? *)",
      enabled: false,
    },
  },
  test: {
    [BatchScheduleId.SAMPLE]: {
      cron: "cron(0 2 * * ? *)",
      enabled: false,
    },
  },
};

/** Every batch here gets its own Step Functions + Cron + starter Lambda. Order does not matter. */
export const RegisteredManifests: BatchManifest[] = [
  createBatchManifest(
    BatchScheduleId.SAMPLE,
    ScheduleByStage[stage][BatchScheduleId.SAMPLE].cron,
    ScheduleByStage[stage][BatchScheduleId.SAMPLE].enabled,
    sampleSteps,
  ),
];
