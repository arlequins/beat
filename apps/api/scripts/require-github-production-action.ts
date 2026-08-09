/** Refuse production mutations from a developer shell. AWS OIDC is the real boundary. */
export function requireGitHubProductionAction() {
  if (process.env.GITHUB_ACTIONS !== "true")
    throw new Error(
      "Beat production operations may run only from the protected GitHub Actions workflow",
    );
  if (process.env.SST_STAGE !== "production")
    throw new Error("Beat production operations require SST_STAGE=production");
}
