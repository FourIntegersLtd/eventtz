import type { NextRequest } from "next/server";
import { proxyRealtimeSse } from "@/lib/realtimeSseProxy";

export const runtime = "nodejs";

/** Live updates for the signed-in user, streamed from `api/`. */
export async function GET(request: NextRequest) {
  return proxyRealtimeSse(request);
}
