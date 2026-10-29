import { generateGuide } from "@/lib/agent/pipeline";
import type { AgentEvent } from "@/lib/agent/events";

export const maxDuration = 300;

// Best-effort, per-instance abuse guard: live generation costs real API spend.
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = Number(process.env.GENERATE_LIMIT_PER_HOUR ?? 12);
const hits = new Map<string, number[]>();

function allow(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export async function POST(request: Request) {
  let body: { query?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const query = typeof body.query === "string" ? body.query : "";
  const force = body.force === true;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (event: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };
      // Keeps proxies from closing an idle connection during long model calls.
      const heartbeat = setInterval(() => emit({ type: "progress", stage: "research", message: "" }), 15_000);
      try {
        if (!allow(ip)) throw new Error("Rate limit reached for live generation. Try again later or browse the library.");
        await generateGuide(query, emit, { force });
      } catch (e) {
        emit({ type: "error", message: (e as Error).message || "Generation failed" });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
