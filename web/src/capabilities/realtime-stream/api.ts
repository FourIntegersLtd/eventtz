/**
 * The realtime-stream capability's one request: mint a short-lived ticket
 * the browser can open the SSE connection with.
 *
 * `EventSource` cannot set an `Authorization` header, so the platform API
 * authenticates the stream through a `ticket` query parameter instead
 * (`api/app/features/realtime/router.py`, ADR 0005). This lives in a
 * capability, not a domain, because both the messages and notifications
 * domains need a live stream and a domain may not import another domain.
 */
import { platformRequest, type components } from "@/foundation/platform-client";

export type StreamTicketResponse = components["schemas"]["StreamTicketResponse"];

/** Ask the platform API for a ticket good for `expires_in_seconds` seconds. */
export function requestStreamTicket(): Promise<StreamTicketResponse> {
  return platformRequest<StreamTicketResponse>("/api/v1/realtime/stream-ticket", { method: "POST" });
}
