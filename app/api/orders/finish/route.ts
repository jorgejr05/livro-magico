import { checkAccess, fail } from "@/lib/server";
import { rpc } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Finaliza o pedido: status, roteiro, erros e tempo de cada etapa.
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { id, status, story, errors, events, totalMs } = await req.json();
    if (typeof id !== "string" || !UUID.test(id)) return fail(new Error("Pedido inválido."), 400);
    await rpc("finish_order", {
      p_id: id,
      p: {
        status,
        story: story ?? null,
        errors: Array.isArray(errors) ? errors.slice(0, 20).map((x: unknown) => String(x).slice(0, 300)) : [],
        events: Array.isArray(events) ? events.slice(0, 40) : [],
        total_ms: Number.isFinite(totalMs) ? Math.round(totalMs) : null,
      },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
