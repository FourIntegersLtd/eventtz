import { NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/backend-url";

/** Same-origin SSE proxy so auth cookies reach FastAPI (see `app/api/realtime/stream/route.ts`). */
export async function proxyRealtimeSse(request: Request): Promise<Response> {
  const backendBase = getBackendBaseUrl();
  const cookie = request.headers.get("cookie") ?? "";

  const upstream = await fetch(`${backendBase}/api/v1/realtime/stream`, {
    headers: {
      Accept: "text/event-stream",
      Cookie: cookie,
    },
    cache: "no-store",
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
