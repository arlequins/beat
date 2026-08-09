import { qualifyBeatProductionStorage } from "../src/production-qualification";
import { requireGitHubProductionAction } from "./require-github-production-action";

requireGitHubProductionAction();

const result = await qualifyBeatProductionStorage();
console.log(JSON.stringify({ ...result, status: "qualified" }));
