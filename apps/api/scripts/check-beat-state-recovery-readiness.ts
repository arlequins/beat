import { inspectBeatStateRecoveryReadiness } from "../src/state-recovery";
import { requireGitHubProductionAction } from "./require-github-production-action";

requireGitHubProductionAction();

const result = await inspectBeatStateRecoveryReadiness();
console.log(JSON.stringify({ ...result, status: "checked" }));
