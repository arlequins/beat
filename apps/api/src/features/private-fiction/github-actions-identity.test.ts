import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn((url: URL) => url),
  jwtVerify: vi.fn(),
}));

afterEach(() => vi.resetAllMocks());

describe("private fiction GitHub Actions identity", () => {
  it("verifies the GitHub issuer, dedicated audience, and exact workflow claims", async () => {
    const jose = await import("jose");
    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload: {
        repository: "arlequins/vaults-reality-error",
        repository_owner: "arlequins",
        repository_visibility: "private",
        ref: "refs/heads/main",
        workflow_ref:
          "arlequins/vaults-reality-error/.github/workflows/sync-private-fiction.yml@refs/heads/main",
        event_name: "push",
      },
      protectedHeader: { alg: "RS256" },
    } as never);
    const { verifyPrivateFictionGitHubActionsToken } = await import(
      "./github-actions-identity"
    );

    await expect(
      verifyPrivateFictionGitHubActionsToken("signed-github-token"),
    ).resolves.toMatchObject({
      repository: "arlequins/vaults-reality-error",
      ref: "refs/heads/main",
      eventName: "push",
    });
    expect(jose.createRemoteJWKSet).toHaveBeenCalledWith(
      new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
    );
    expect(jose.jwtVerify).toHaveBeenCalledWith(
      "signed-github-token",
      expect.any(URL),
      expect.objectContaining({
        algorithms: ["RS256"],
        audience: "beat-private-fiction-sync",
        issuer: "https://token.actions.githubusercontent.com",
        maxTokenAge: "10 minutes",
        requiredClaims: ["exp", "iat"],
      }),
    );
  });

  it.each([
    { repository: "other/repository" },
    { repository_owner: "other" },
    { repository_visibility: "public" },
    { ref: "refs/heads/feature" },
    {
      workflow_ref:
        "arlequins/vaults-reality-error/.github/workflows/other.yml@refs/heads/main",
    },
    { event_name: "pull_request" },
  ])(
    "rejects a token whose trusted workflow claim differs: %o",
    async (change) => {
      const jose = await import("jose");
      vi.mocked(jose.jwtVerify).mockResolvedValue({
        payload: {
          repository: "arlequins/vaults-reality-error",
          repository_owner: "arlequins",
          repository_visibility: "private",
          ref: "refs/heads/main",
          workflow_ref:
            "arlequins/vaults-reality-error/.github/workflows/sync-private-fiction.yml@refs/heads/main",
          event_name: "workflow_dispatch",
          ...change,
        },
        protectedHeader: { alg: "RS256" },
      } as never);
      const { verifyPrivateFictionGitHubActionsToken } = await import(
        "./github-actions-identity"
      );

      await expect(
        verifyPrivateFictionGitHubActionsToken("signed-github-token"),
      ).rejects.toThrow("Untrusted GitHub Actions identity");
    },
  );
});
