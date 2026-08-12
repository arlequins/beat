import { loadBeatRuntimeSecret } from "./runtime-secret";

export async function handler() {
  await loadBeatRuntimeSecret();
  const [{ createLogger, createTelemetry }, { reconcileBeatProductionState }] =
    await Promise.all([
      import("@arlequins/logger"),
      import("./reconciliation"),
    ]);
  const stage = process.env.SST_STAGE ?? "production";
  let failureMetricEmitted = false;
  const logger = createLogger({ service: "beat-reconciler" });
  const telemetry = createTelemetry({
    metricNamespace: "Beat/Operations",
    service: "beat-reconciler",
  });
  try {
    const summary = await reconcileBeatProductionState();
    const failures =
      summary.publication.failures.length + summary.stateAudit.failures.length;
    telemetry.metric("ReconciliationFailure", failures, "Count", { stage });
    failureMetricEmitted = true;
    telemetry.metric(
      "ReconciliationBacklog",
      summary.publication.failures.length,
      "Count",
      { stage },
    );
    telemetry.metric(
      "UnexpectedDeleteMarker",
      summary.stateAudit.unexpectedDeleteMarkers,
      "Count",
      { stage },
    );
    logger.info("beat.reconciliation.completed", {
      publicationChecked: summary.publication.checked,
      publicationClosed: summary.publication.closed,
      publicationFailures: summary.publication.failures.length,
      publicationMerged: summary.publication.merged,
      publicationOpened: summary.publication.opened,
      stateEvidenceCreated: summary.stateAudit.newEvidence,
      stateFailures: summary.stateAudit.failures.length,
      stateVersionsChecked: summary.stateAudit.checked,
      unexpectedDeleteMarkers: summary.stateAudit.unexpectedDeleteMarkers,
    });
    if (failures > 0 || summary.stateAudit.unexpectedDeleteMarkers > 0)
      throw new Error("Beat reconciliation requires operator attention");
    return summary;
  } catch (error) {
    if (!failureMetricEmitted)
      telemetry.metric("ReconciliationFailure", 1, "Count", { stage });
    logger.error("beat.reconciliation.failed", { error });
    throw error;
  }
}
