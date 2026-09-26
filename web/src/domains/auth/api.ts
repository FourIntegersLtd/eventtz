/**
 * The auth domain's requests. Components never call `platformRequest`
 * directly (enforced by `eslint.config.mjs`'s `no-restricted-imports`) — they
 * call the named functions here, which wrap `foundation/platform-client`'s
 * session-aware `login`/`register`/etc.
 */
export {
  login,
  register,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
  resendVerification,
  verifyEmail,
} from "@/foundation/platform-client";
