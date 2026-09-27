/** Barrel for the shared admin console chrome, used by every `domains/admin-*` domain. */
export { AdminShell } from "@/capabilities/admin-shell/AdminShell";
export {
  AdminLoadingState,
  AdminErrorBanner,
  AdminSuccessBanner,
  AdminEmptyState,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
  AdminKpiCard,
  AdminPagination,
} from "@/capabilities/admin-shell/AdminUi";
export { formatDate, formatDateTime, formatGbp, humanize } from "@/capabilities/admin-shell/format";
export { isSuperAdmin, adminCapabilities } from "@/capabilities/admin-shell/permissions";
export { ADMIN_NAV, type AdminNavItem } from "@/capabilities/admin-shell/nav";
