import api from "@/lib/axios";

export type ContactSubject =
  | "general"
  | "booking_problem"
  | "payments"
  | "account"
  | "other";

export const CONTACT_SUBJECT_OPTIONS: { value: ContactSubject; label: string }[] = [
  { value: "general", label: "General" },
  { value: "booking_problem", label: "Booking problem" },
  { value: "payments", label: "Payments" },
  { value: "account", label: "Account" },
  { value: "other", label: "Other" },
];

export type ContactSubmitBody = {
  subject: ContactSubject;
  message: string;
  booking_id?: string | null;
};

export async function submitClientContact(body: ContactSubmitBody): Promise<void> {
  await api.post("/api/v1/client/contact", body);
}

export async function submitVendorContact(body: ContactSubmitBody): Promise<void> {
  await api.post("/api/v1/vendor/contact", body);
}
