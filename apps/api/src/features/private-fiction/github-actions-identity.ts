import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

export const PRIVATE_FICTION_GITHUB_OIDC_AUDIENCE = "beat-private-fiction-sync";

const GITHUB_ACTIONS_ISSUER = "https://token.actions.githubusercontent.com";
const TRUSTED_REPOSITORY = "arlequins/vaults-reality-error";
const TRUSTED_REF = "refs/heads/main";
const TRUSTED_WORKFLOW_REF =
  TRUSTED_REPOSITORY +
  "/.github/workflows/sync-private-fiction.yml@" +
  TRUSTED_REF;
const githubActionsJwks = createRemoteJWKSet(
  new URL(`${GITHUB_ACTIONS_ISSUER}/.well-known/jwks`),
);

export type PrivateFictionGitHubActionsIdentity = {
  repository: string;
  ref: string;
  workflowRef: string;
  eventName: string;
};

export function trustedPrivateFictionGitHubActionsIdentity(
  payload: JWTPayload,
): PrivateFictionGitHubActionsIdentity {
  const repository = payload.repository;
  const repositoryOwner = payload.repository_owner;
  const repositoryVisibility = payload.repository_visibility;
  const ref = payload.ref;
  const workflowRef = payload.workflow_ref;
  const eventName = payload.event_name;

  if (
    repository !== TRUSTED_REPOSITORY ||
    repositoryOwner !== "arlequins" ||
    repositoryVisibility !== "private" ||
    ref !== TRUSTED_REF ||
    workflowRef !== TRUSTED_WORKFLOW_REF ||
    (eventName !== "push" && eventName !== "workflow_dispatch")
  )
    throw new Error("Untrusted GitHub Actions identity");

  return { repository, ref, workflowRef, eventName };
}

export async function verifyPrivateFictionGitHubActionsToken(
  token: string,
): Promise<PrivateFictionGitHubActionsIdentity> {
  const { payload } = await jwtVerify(token, githubActionsJwks, {
    algorithms: ["RS256"],
    audience: PRIVATE_FICTION_GITHUB_OIDC_AUDIENCE,
    issuer: GITHUB_ACTIONS_ISSUER,
    maxTokenAge: "10 minutes",
    requiredClaims: ["exp", "iat"],
  });
  return trustedPrivateFictionGitHubActionsIdentity(payload);
}
