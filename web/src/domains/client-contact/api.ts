/**
 * API access for the client's contact page: sends a message to the Eventtz
 * team through `POST /api/v1/client/contact`, optionally about one booking.
 */
import { platformRequest, type components } from "@/foundation/platform-client";

export type ContactSubmitBody = components["schemas"]["ContactSubmitBody"];

/** Send a client's message to the Eventtz team, optionally about one booking. */
export async function submitClientContact(body: ContactSubmitBody): Promise<void> {
  await platformRequest<components["schemas"]["ContactSubmitResponse"]>("/api/v1/client/contact", {
    method: "POST",
    body,
  });
}
