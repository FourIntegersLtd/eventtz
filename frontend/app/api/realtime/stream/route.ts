import { proxyRealtimeSse } from "@/lib/realtimeSseProxy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return proxyRealtimeSse(request);
}
