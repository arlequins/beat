#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const backupRoot = resolve(root, ".template/example-crud");
const files = [
  "apps/web/src/app/page.tsx",
  "apps/web/src/components/posts.tsx",
  "packages/trpc/src/contract.test.ts",
  "packages/trpc/src/root.ts",
  "packages/trpc/src/router/post.ts",
];

function formatChangedFiles(includeCrudFiles) {
  const paths = [
    "template.features.json",
    "apps/web/src/app/page.tsx",
    "packages/trpc/src/contract.test.ts",
    "packages/trpc/src/root.ts",
    ...(includeCrudFiles
      ? [
          "apps/web/src/components/posts.tsx",
          "packages/trpc/src/router/post.ts",
        ]
      : []),
  ];
  execFileSync("pnpm", ["exec", "biome", "format", "--write", ...paths], {
    cwd: root,
    stdio: "inherit",
  });
}

async function copyFiles(sourceRoot, targetRoot) {
  for (const path of files) {
    const target = resolve(targetRoot, path);
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(sourceRoot, path), target);
  }
}

async function updateFeature(enabled) {
  const path = resolve(root, "template.features.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  const features = new Set(config.features);
  if (enabled) features.add("example-ui");
  else features.delete("example-ui");
  config.features = [...features];
  await writeFile(path, `${JSON.stringify(config, undefined, 2)}\n`);
}

async function removeExample() {
  await copyFiles(root, backupRoot);
  await rm(resolve(root, "apps/web/src/components/posts.tsx"));
  await rm(resolve(root, "packages/trpc/src/router/post.ts"));

  const packageJson = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  await writeFile(
    resolve(root, "apps/web/src/app/page.tsx"),
    `"use client";\n\nimport { env } from "~/env";\n\nexport default function HomePage() {\n  return (\n    <main className="container py-16">\n      <h1 className="text-4xl font-bold">${packageJson.name}</h1>\n      <p className="text-muted-foreground mt-4">\n        API: {env.NEXT_PUBLIC_API_URL}\n      </p>\n    </main>\n  );\n}\n`,
  );

  const rootPath = resolve(root, "packages/trpc/src/root.ts");
  const routerSource = await readFile(rootPath, "utf8");
  await writeFile(
    rootPath,
    routerSource
      .replace('import { postRouter } from "./router/post";\n', "")
      .replace("  post: postRouter,\n", ""),
  );

  const contractPath = resolve(root, "packages/trpc/src/contract.test.ts");
  const contractSource = await readFile(contractPath, "utf8");
  await writeFile(
    contractPath,
    contractSource
      .replace('["auth", "post"]', '["auth"]')
      .replace(
        /\n {4}expect\(procedureNames\(AppRouter\._def\.record\.post\)\)\.toEqual\(\[[\s\S]*? {4}\]\);/,
        "",
      ),
  );
  await updateFeature(false);
  formatChangedFiles(false);
  console.log(
    `Example CRUD surface removed. Backup retained at ${backupRoot}.`,
  );
}

async function regenerateExample() {
  await copyFiles(backupRoot, root);
  await rm(backupRoot, { recursive: true });
  await updateFeature(true);
  formatChangedFiles(true);
  console.log("Example CRUD surface regenerated.");
}

const operation = process.argv[2];
if (operation === "remove") await removeExample();
else if (operation === "regenerate") await regenerateExample();
else
  throw new Error("Usage: node scripts/example-crud.mjs <remove|regenerate>");
