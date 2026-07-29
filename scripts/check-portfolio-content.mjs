import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

import ts from "typescript";

const webRequire = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const matter = webRequire("gray-matter");

const root = process.cwd();
const postsDirectory = join(root, "apps/web/content/posts");
const translationsFile = join(root, "apps/web/src/lib/localized-content.ts");
const categories = new Set(["weekly", "deep-dive", "studio-log"]);
const reviewStatuses = new Set(["unreviewed", "reviewed"]);
const requiredFields = [
  "category",
  "excerpt",
  "publishedAt",
  "readTime",
  "reviewStatus",
  "tags",
  "title",
];

const failures = [];

function fail(message) {
  failures.push(message);
}

function propertyName(property) {
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) {
    return property.name.text;
  }
  return undefined;
}

function translationSlugs(source, variableName) {
  const parsed = ts.createSourceFile(
    translationsFile,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let object;

  for (const statement of parsed.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === variableName &&
        declaration.initializer &&
        ts.isObjectLiteralExpression(declaration.initializer)
      ) {
        object = declaration.initializer;
      }
    }
  }

  if (!object) {
    fail(`Could not find the ${variableName} translation object.`);
    return new Set();
  }

  return new Set(
    object.properties.flatMap((property) => {
      if (!ts.isPropertyAssignment(property)) return [];
      const name = propertyName(property);
      return name ? [name] : [];
    }),
  );
}

const files = (await readdir(postsDirectory))
  .filter((file) => file.endsWith(".mdx"))
  .sort();
const postSlugs = new Set();

for (const filename of files) {
  const relativePath = `apps/web/content/posts/${filename}`;
  const source = await readFile(join(postsDirectory, filename), "utf8");
  const { content, data } = matter(source);
  const slug = filename.replace(/\.mdx$/, "");
  postSlugs.add(slug);

  for (const field of requiredFields) {
    if (!(field in data))
      fail(`${relativePath}: missing frontmatter ${field}.`);
  }
  if (typeof data.title !== "string" || data.title.trim().length === 0) {
    fail(`${relativePath}: title must be a non-empty string.`);
  }
  if (typeof data.excerpt !== "string" || data.excerpt.trim().length === 0) {
    fail(`${relativePath}: excerpt must be a non-empty string.`);
  }
  if (!categories.has(data.category)) {
    fail(`${relativePath}: category must be weekly, deep-dive, or studio-log.`);
  }
  if (!reviewStatuses.has(data.reviewStatus)) {
    fail(`${relativePath}: reviewStatus must be unreviewed or reviewed.`);
  }
  if (typeof data.readTime !== "string" || data.readTime.trim().length === 0) {
    fail(`${relativePath}: readTime must be a non-empty string.`);
  }
  if (
    !Array.isArray(data.tags) ||
    data.tags.length === 0 ||
    data.tags.some((tag) => typeof tag !== "string" || tag.trim().length === 0)
  ) {
    fail(`${relativePath}: tags must be a non-empty string array.`);
  }
  if (
    typeof data.publishedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.publishedAt) ||
    Number.isNaN(Date.parse(`${data.publishedAt}T00:00:00.000Z`)) ||
    new Date(`${data.publishedAt}T00:00:00.000Z`).toISOString().slice(0, 10) !==
      data.publishedAt
  ) {
    fail(`${relativePath}: publishedAt must be a valid YYYY-MM-DD date.`);
  }
  if (content.trim().length === 0) {
    fail(`${relativePath}: article body must not be empty.`);
  }
}

const translationSource = await readFile(translationsFile, "utf8");
for (const locale of ["english", "japanese"]) {
  const translatedSlugs = translationSlugs(translationSource, locale);
  for (const slug of postSlugs) {
    if (!translatedSlugs.has(slug)) {
      fail(`${locale}: missing translation record for ${slug}.`);
    }
  }
  for (const slug of translatedSlugs) {
    if (!postSlugs.has(slug)) {
      fail(`${locale}: translation record has no matching MDX post: ${slug}.`);
    }
  }
}

if (failures.length > 0) {
  console.error("Portfolio content validation failed:\n");
  for (const message of failures) console.error(`- ${message}`);
  process.exitCode = 1;
} else {
  console.log(
    `Portfolio content is valid: ${files.length} MDX posts with English and Japanese records.`,
  );
}
