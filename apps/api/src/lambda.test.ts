import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  lambdaHandler: vi.fn(async () => ({ statusCode: 200 })),
  loadRuntimeSecret: vi.fn(async () => {}),
  startObservability: vi.fn(async () => {}),
}));

vi.mock("./runtime-secret", () => ({
  loadBeatRuntimeSecret: mocks.loadRuntimeSecret,
}));
vi.mock("@arlequins/env/server-env", () => ({ serverEnv: {} }));
vi.mock("@arlequins/logger", () => ({
  startObservability: mocks.startObservability,
}));
vi.mock("hono/aws-lambda", () => ({ handle: mocks.handle }));
vi.mock("./app", () => ({ app: {} }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("Lambda handler", () => {
  it("does not require browser OIDC variables during server initialization", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("NEXT_PUBLIC_OIDC_AUTHORITY", "");
    vi.stubEnv("NEXT_PUBLIC_OIDC_CLIENT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_OIDC_SCOPE", "");
    mocks.handle.mockReturnValue(mocks.lambdaHandler);

    const { handler } = await import("./lambda");

    await expect(handler({}, {})).resolves.toEqual({ statusCode: 200 });
    expect(mocks.loadRuntimeSecret).toHaveBeenCalledOnce();
    expect(mocks.startObservability).toHaveBeenCalledOnce();
    expect(mocks.handle).toHaveBeenCalledOnce();
  });
});
