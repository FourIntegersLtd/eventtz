import api from "@/lib/axios";

export type ContactSubmitBody = {
  message: string;
  booking_id?: string | null;
};

export async function submitClientContact(body: ContactSubmitBody): Promise<void> {
  await api.post("/api/v1/client/contact", body);
}

export async function submitVendorContact(body: ContactSubmitBody): Promise<void> {
  await api.post("/api/v1/vendor/contact", body);
}

export async function submitAdminContact(message: string): Promise<void> {
  await api.post("/api/v1/admin/contact", { message });
}
