import type { AuthSession, TRPCAuth } from "@arlequins/auth";
import type { Logger, Telemetry } from "@arlequins/logger";
import type { ContentService, FileUploadService } from "@arlequins/service";

export type TRPCServices = {
  content: ContentService;
  fileUpload?: FileUploadService;
};

export type TRPCContext = {
  authApi: TRPCAuth;
  logger: Logger;
  telemetry: Telemetry;
  session: AuthSession | null;
  services: TRPCServices;
};

export type CreateTRPCContextOptions = {
  headers: Headers;
  logger: Logger;
  telemetry: Telemetry;
};
