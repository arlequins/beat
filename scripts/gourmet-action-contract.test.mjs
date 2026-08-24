import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaUrl = new URL(
  "../docs/gourmet-action.openapi.yaml",
  import.meta.url,
);
const productionOrigin =
  "https://4kfwvp7y2qoprape5p2jr5qvra0ekgcl.lambda-url.ap-northeast-1.on.aws";

const readSchema = () => readFile(schemaUrl, "utf8");

test("Custom GPT Action targets the Beat production API", async () => {
  const schema = await readSchema();

  assert.ok(schema.includes(`  - url: ${productionOrigin}\n`));
  assert.match(schema, /bearerAuth:\n {6}type: http\n {6}scheme: bearer/);
  assert.match(schema, /enum: \["yes", "no", unknown\]/);
  assert.match(
    schema,
    /name: status[\s\S]{0,180}enum: \[draft, published, deleted\]/,
  );
  assert.match(schema, /parameters:\n {8}- in: path\n {10}name: id/);
  assert.match(
    schema,
    /schema: \{ \$ref: "#\/components\/schemas\/GourmetPatch" \}/,
  );
  assert.match(schema, /averageRating: \{ type: number \}/);
});

test("Custom GPT Action marks reads and writes with explicit confirmation semantics", async () => {
  const schema = await readSchema();

  for (const operationId of [
    "listGourmetEntries",
    "getGourmetEntry",
    "getGourmetContext",
  ]) {
    assert.match(
      schema,
      new RegExp(
        `operationId: ${operationId}[\\s\\S]{0,240}x-openai-isConsequential: false`,
      ),
    );
  }

  const guide = await readFile(
    new URL("../docs/gourmet-custom-gpt.md", import.meta.url),
    "utf8",
  );
  assert.match(guide, /always call listGourmetEntries with status=draft/);

  for (const operationId of ["createGourmetEntry", "updateGourmetEntry"]) {
    assert.match(
      schema,
      new RegExp(
        `operationId: ${operationId}[\\s\\S]{0,240}x-openai-isConsequential: true`,
      ),
    );
  }
});

test("public Action artifacts do not contain a literal API credential", async () => {
  const [schema, guide] = await Promise.all([
    readSchema(),
    readFile(new URL("../docs/gourmet-custom-gpt.md", import.meta.url), "utf8"),
  ]);

  for (const artifact of [schema, guide]) {
    assert.doesNotMatch(
      artifact,
      /Authorization:\s*Bearer\s+(?!<)[A-Za-z0-9_-]{24,}/,
    );
    assert.doesNotMatch(
      artifact,
      /BEAT_GOURMET_ACTION_API_KEY\s*=\s*[A-Za-z0-9_-]{24,}/,
    );
  }
});
