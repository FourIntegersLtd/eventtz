/** Client-side checks before `changeAdminPassword`, matching the settings form copy. */

export function validatePasswordChange(
  newPassword: string,
  confirmPassword: string,
): string | null {
  if (newPassword !== confirmPassword) {
    return "The new password and confirmation don't match.";
  }
  return null;
}
