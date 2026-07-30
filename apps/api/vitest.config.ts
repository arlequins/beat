import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/dev.ts", "src/lambda.ts"],
      provider: "v8",
      thresholds: { branches: 75, functions: 75, lines: 75, statements: 75 },
    },
  },
});
