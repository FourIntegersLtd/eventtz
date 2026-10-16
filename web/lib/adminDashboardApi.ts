import api from "@/lib/axios";

export type AdminDashboardSummary = {
  success: boolean;
  users_client: number;
  users_vendor: number;
  users_admin: number;
  vendors_pending: number;
  vendors_approved: number;
  vendors_banned: number;
  bookings_pending: number;
  bookings_accepted: number;
  bookings_completed: number;
  bookings_declined: number;
  bookings_cancelled: number;
  bookings_paid_count: number;
  bookings_needing_support: number;
  conversations_count: number;
  reviews_count: number;
};

export type AdminDashboardTimeBucket = {
  date: string;
  count: number;
  gmv_gbp: number;
};

export type AdminDashboardSignupBucket = {
  date: string;
  clients: number;
  vendors: number;
};

export type AdminDashboardMetrics = {
  success: boolean;
  period_days: number;
  bookings_created: AdminDashboardTimeBucket[];
  bookings_paid: AdminDashboardTimeBucket[];
  signups: AdminDashboardSignupBucket[];
  open_disputes_count: number;
};

export async function fetchAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const { data } = await api.get<AdminDashboardSummary>("/api/v1/admin/dashboard-summary");
  return data;
}

export async function fetchAdminDashboardMetrics(days = 30): Promise<AdminDashboardMetrics> {
  const { data } = await api.get<AdminDashboardMetrics>("/api/v1/admin/dashboard-metrics", {
    params: { days },
  });
  return data;
}

export type AdminMarketplaceAnalytics = {
  success: boolean;
  from_date: string;
  to_date: string;
  overview: Record<string, number | null>;
  enquiries_by_month: { month: string; count: number }[];
  completed_by_month: { month: string; count: number }[];
  by_category: {
    key: string;
    enquiries: number;
    accepted: number;
    paid: number;
    completed: number;
    failed: number;
    conversion_rate: number;
    avg_booking_value_gbp: number;
    revenue_gbp: number;
  }[];
  by_location: {
    key: string;
    enquiries: number;
    failed: number;
    conversion_rate: number;
  }[];
  failure_reasons: { reason: string; count: number }[];
  top_vendors: {
    vendor_user_id: string;
    business_name: string;
    enquiries: number;
    completed: number;
    conversion_rate: number;
    avg_response_seconds: number | null;
    revenue_gbp: number;
  }[];
  recruitment_hints: {
    categories: { category: string; enquiries: number; failed: number; message: string }[];
    locations: { location: string; enquiries: number; failed: number; message: string }[];
  };
};

export async function fetchAdminMarketplaceAnalytics(params?: {
  from_date?: string;
  to_date?: string;
  country_code?: string;
}): Promise<AdminMarketplaceAnalytics> {
  const { data } = await api.get<AdminMarketplaceAnalytics>(
    "/api/v1/admin/marketplace-analytics",
    { params },
  );
  return data;
}
