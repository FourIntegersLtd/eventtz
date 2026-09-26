/** Barrel for the platform client. Pages and `api.ts` files import from here. */
export {
  platformRequest,
  platformApiUrl,
  setPlatformTokenSource,
  type RequestOptions,
} from "@/foundation/platform-client/client";
export {
  PlatformError,
  PlatformTransportError,
  isPlatformError,
  hasCode,
  type PlatformErrorCode,
  type PlatformErrorBody,
} from "@/foundation/platform-client/errors";
export {
  installPlatformAuth,
  hasStoredSession,
  login,
  register,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
  resendVerification,
  verifyEmail,
  rememberPlatformSession,
  clearPlatformSession,
  platformAccessToken,
} from "@/foundation/platform-client/auth";
export type { components, paths } from "@/foundation/platform-client/schema";
export { platformErrorDetail, GENERIC_ERROR_MESSAGE } from "@/foundation/platform-client/errorMessage";
