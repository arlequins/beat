import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "tools", "chatgpt-beat-export");
const outputDir = join(root, "dist", "chatgpt-beat-export");
const expectedFiles = [
  "background.js",
  "content-beat-admin.js",
  "content-chatgpt.js",
  "manifest.json",
  "popup.html",
  "popup.js",
];

async function assertPackageContents() {
  const entries = await readdir(sourceDir);
  const unexpected = entries.filter(
    (entry) => !expectedFiles.includes(entry) && entry !== "README.md",
  );
  if (unexpected.length > 0)
    throw new Error(`Unexpected exporter files: ${unexpected.join(", ")}`);
  const manifest = JSON.parse(
    await readFile(join(sourceDir, "manifest.json"), "utf8"),
  );
  if (manifest.manifest_version !== 3 || typeof manifest.version !== "string")
    throw new Error(
      "Exporter manifest must be a Manifest V3 package with a version",
    );
  const source = (
    await Promise.all(
      expectedFiles.map((file) => readFile(join(sourceDir, file), "utf8")),
    )
  ).join("\n");
  if (
    /BEAT_GOURMET_ACTION_API_KEY|refreshToken|BEGIN (RSA|EC) PRIVATE KEY/.test(
      source,
    )
  )
    throw new Error("Exporter package contains a forbidden credential marker");
  return manifest.version;
}

function run(command, args, cwd = root) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else
        reject(new Error(`${command} exited with status ${code ?? "unknown"}`));
    });
  });
}

const version = await assertPackageContents();
await rm(outputDir, { force: true, recursive: true });
await mkdir(outputDir, { recursive: true });
const packageRoot = join(outputDir, `beat-gourmet-chatgpt-export-v${version}`);
await mkdir(packageRoot, { recursive: true });
for (const file of expectedFiles)
  await writeFile(
    join(packageRoot, file),
    await readFile(join(sourceDir, file)),
  );

const archive = join(outputDir, `beat-gourmet-chatgpt-export-v${version}.zip`);
await run("zip", ["-qr", basename(archive), basename(packageRoot)], outputDir);
const digest = createHash("sha256")
  .update(await readFile(archive))
  .digest("hex");
await writeFile(`${archive}.sha256`, `${digest}  ${basename(archive)}\n`);
console.log(`Created ${archive}`);
