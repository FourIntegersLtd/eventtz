/** Display label for an admin colleague's role in the team table. */

export function adminMemberRoleLabel(adminRole: string | null | undefined): string {
  return adminRole === "super_admin" ? "Super admin" : "Admin";
}
