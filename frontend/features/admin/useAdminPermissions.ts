"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import {
  canExportFinancials,
  canManageAdminTeam,
  canModerateReviews,
  canModerateVendors,
  canResolveDisputesFinancially,
  canRunBookingSupportActions,
  canSuspendClients,
} from "@/lib/adminPermissions";
import { isSuperAdmin, resolveAdminRole } from "@/lib/adminRole";

export function useAdminPermissions() {
  const { user } = useAuth();
  const role = resolveAdminRole(user);
  const superAdmin = isSuperAdmin(user);

  return {
    user,
    role,
    isSuperAdmin: superAdmin,
    canManageTeam: canManageAdminTeam(user),
    canRunBookingSupportActions: canRunBookingSupportActions(user),
    canModerateVendors: canModerateVendors(user),
    canSuspendClients: canSuspendClients(user),
    canResolveDisputesFinancially: canResolveDisputesFinancially(user),
    canModerateReviews: canModerateReviews(user),
    canExportFinancials: canExportFinancials(user),
  };
}
