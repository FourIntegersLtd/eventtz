import { platformRequest, type components } from "@/foundation/platform-client";

export type ContactSubmitBody = components["schemas"]["ContactSubmitBody"];

/** Send a vendor's message to the Eventtz team, optionally about one booking. */
export async function submitVendorContact(body: ContactSubmitBody): Promise<void> {
  await platformRequest<components["schemas"]["ContactSubmitResponse"]>("/api/v1/vendor/contact", {
    method: "POST",
    body,
  });
}
