import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function findStringValues(value, key, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) findStringValues(item, key, found);
    return found;
  }
  if (!value || typeof value !== "object") return found;
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key && typeof entryValue === "string")
      found.push(entryValue);
    findStringValues(entryValue, key, found);
  }
  return found;
}

export function readSstOutput(source, outputName) {
  const parsed = JSON.parse(source);
  const values = [...new Set(findStringValues(parsed, outputName))];
  if (values.length !== 1)
    throw new Error(
      `Expected exactly one SST output named ${outputName}, found ${values.length}`,
    );
  return values[0];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [stateFile, outputName] = process.argv.slice(2);
  if (!stateFile || !outputName)
    throw new Error(
      "Usage: node scripts/read-sst-output.mjs <state-file> <output-name>",
    );
  process.stdout.write(
    readSstOutput(readFileSync(stateFile, "utf8"), outputName),
  );
}
