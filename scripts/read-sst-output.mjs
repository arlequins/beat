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

function parseJsonDocument(source) {
  try {
    return JSON.parse(source);
  } catch {
    // pnpm lifecycle banners can precede SST's JSON even when stdout is
    // redirected. Locate a complete JSON document without echoing state data.
    const lineStart = /(?:^|\r?\n)[\t ]*(\[|{)/g;
    for (const match of source.matchAll(lineStart)) {
      const start = (match.index ?? 0) + match[0].lastIndexOf(match[1]);
      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let index = start; index < source.length; index += 1) {
        const character = source[index];
        if (inString) {
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === '"') inString = false;
          continue;
        }
        if (character === '"') inString = true;
        else if (character === "{" || character === "[") depth += 1;
        else if (character === "}" || character === "]") depth -= 1;

        if (depth !== 0) continue;
        try {
          return JSON.parse(source.slice(start, index + 1));
        } catch {
          break;
        }
      }
    }
  }
  throw new Error("Unable to parse SST state JSON from command output");
}

export function readSstOutput(source, outputName) {
  const parsed = parseJsonDocument(source);
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
