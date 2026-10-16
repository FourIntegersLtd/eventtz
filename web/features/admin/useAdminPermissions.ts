"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import {
  canApproveVendors,
  canBanVendors,
  canBroadcastMessages,
  canExportFinancials,
  canManageAdminTeam,
  canModerateReviews,
  canModerateVendors,
  canOverrideVendorListing,
  canResetVendorListingOverride,
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
    canApproveVendors: canApproveVendors(user),
    canBanVendors: canBanVendors(user),
    canOverrideVendorListing: canOverrideVendorListing(user),
    canResetVendorListingOverride: canResetVendorListingOverride(user),
    canBroadcastMessages: canBroadcastMessages(user),
    canModerateVendors: canModerateVendors(user),
    canSuspendClients: canSuspendClients(user),
    canResolveDisputesFinancially: canResolveDisputesFinancially(user),
    canModerateReviews: canModerateReviews(user),
    canExportFinancials: canExportFinancials(user),
  };
}
