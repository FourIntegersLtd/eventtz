import { NextResponse, type NextRequest } from "next/server";
import { getBackendBaseUrl } from "@/lib/backend-url";
import { readSession } from "@/lib/platformSession";

/**
 * Same-origin SSE proxy (see `app/api/realtime/stream/route.ts`).
 *
 * `api/` authenticates the stream with a short-lived ticket in the query
 * string rather than a cookie (ADR 0005), so this mints one with the
 * session's Bearer token and then opens the stream with it.
 */
export async function proxyRealtimeSse(request: NextRequest): Promise<Response> {
  const backendBase = getBackendBaseUrl();
  const { accessToken } = readSession(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const ticketResponse = await fetch(`${backendBase}/api/v1/realtime/stream-ticket`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!ticketResponse.ok) {
    // Usually an expired access token: the page's next API call refreshes it,
    // and EventSource retries on its own.
    return NextResponse.json({ error: `Stream ticket failed: ${ticketResponse.status}` }, { status: ticketResponse.status });
  }
  const { ticket } = (await ticketResponse.json()) as { ticket: string };

  const upstream = await fetch(`${backendBase}/api/v1/realtime/stream?ticket=${encodeURIComponent(ticket)}`, {
    headers: { Accept: "text/event-stream" },
    cache: "no-store",
    signal: request.signal,
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Upstream SSE failed: ${upstream.status}` },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
