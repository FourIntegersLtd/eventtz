/** Re-export facade — prefer domain modules for new imports; this file keeps existing call sites stable. */
export {
  type AdminDashboardSummary,
  type AdminDashboardTimeBucket,
  type AdminDashboardSignupBucket,
  type AdminDashboardMetrics,
  fetchAdminDashboardSummary,
  fetchAdminDashboardMetrics,
  type AdminMarketplaceAnalytics,
  fetchAdminMarketplaceAnalytics,
} from "@/lib/adminDashboardApi";

export {
  type AdminBookingListSupportSummary,
  type AdminBookingListItem,
  type AdminBookingsListResponse,
  type AdminBookingsQuery,
  fetchAdminBookings,
  fetchAdminBookingDetail,
  patchBookingPaymentFields,
  type AdminBookingAttentionFlag,
  type AdminBookingSupportMeta,
  type AdminBookingDetail,
  adminSyncBookingPayment,
  adminResetBookingCheckout,
  adminReleaseBookingPayout,
  adminRetryBookingPayout,
  adminCompleteBookingCancellation,
  adminCancelBookingOnBehalf,
  adminConfirmBookingCompletion,
  adminRunBookingMaintenance,
  adminSetBookingSupportHold,
} from "@/lib/adminBookingsApi";

export {
  type AdminFinancialsDailyBucket,
  type AdminFinancialsSummary,
  fetchAdminFinancials,
  downloadAdminFinancialsCsv,
} from "@/lib/adminFinancialsApi";

export {
  type AdminClientRow,
  type AdminClientsQuery,
  type AdminClientsListResult,
  fetchAdminClients,
  type AdminDirectoryUser,
  searchAdminDirectoryUsers,
  patchClientSuspended,
} from "@/lib/adminDirectoryApi";

export {
  type AdminDisputeCase,
  fetchAdminDisputes,
  patchAdminDispute,
  type AdminReviewRow,
  fetchAdminReviews,
  fetchAdminReview,
  patchReviewVisibility,
  type AdminChatMessageItem,
  type AdminChatConversationPayload,
  fetchAdminChatMessages,
} from "@/lib/adminTrustApi";

export {
  type AdminAuditLogItem,
  fetchAdminAuditLog,
  fetchAdminAuditLogEntry,
} from "@/lib/adminAuditApi";
