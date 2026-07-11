import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const backendBase =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://127.0.0.1:8000";

  // Forward cookies so the backend can auth the SSE request.
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

