import { qualifyBeatProductionStorage } from "../src/production-qualification";

const result = await qualifyBeatProductionStorage();
console.log(JSON.stringify({ ...result, status: "qualified" }));
