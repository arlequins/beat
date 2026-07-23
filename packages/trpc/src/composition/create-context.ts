import { authApi, provisionSessionUser } from "@acme/auth";
import { db } from "@acme/db-backbone/client";
import { serverEnv } from "@acme/env";
import { createContentService, createFileUploadService } from "@acme/service";
import { createDatabaseUserProvisioning } from "../adaptors/auth-user";
import { createDrizzlePostRepository } from "../adaptors/post-repository";
import { createS3FileUploadAdapter } from "../adaptors/s3-file-upload";
import { getPostCache } from "../cache";
import type { CreateTRPCContextOptions, TRPCContext } from "../context";

function bootstrapAdministratorIdentities() {
  return new Set(
    (serverEnv.AUTH_BOOTSTRAP_ADMIN_IDENTITIES ?? "")
      .split(",")
      .map((identity) => identity.trim())
      .filter(Boolean),
  );
}

export async function createTRPCContext(
  options: CreateTRPCContextOptions,
): Promise<TRPCContext> {
  const tokenSession = await authApi.getSession({ headers: options.headers });
  const session = tokenSession
    ? await options.telemetry.trace(
        "db.user.provision",
        { "db.system": "postgresql" },
        () =>
          provisionSessionUser(
            createDatabaseUserProvisioning(db, {
              bootstrapAdministrators: bootstrapAdministratorIdentities(),
            }),
            tokenSession,
          ),
      )
    : null;

  if (session)
    options.logger.info("auth.login.succeeded", {
      issuer: session.user.issuer,
      subject: session.user.subject,
      userId: session.user.id,
    });

  return {
    authApi,
    logger: options.logger,
    telemetry: options.telemetry,
    session,
    services: {
      content: createContentService({
        logger: options.logger.child({ component: "content-service" }),
        repository: createDrizzlePostRepository(db, { cache: getPostCache() }),
      }),
      fileUpload: serverEnv.S3_UPLOAD_BUCKET
        ? createFileUploadService({
            storage: createS3FileUploadAdapter({
              bucket: serverEnv.S3_UPLOAD_BUCKET,
              prefix: serverEnv.S3_UPLOAD_PREFIX,
            }),
          })
        : undefined,
    },
  };
}
