import { checkAccess, fail, need } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 15;

// Saldo de créditos da ElevenLabs. Lido antes e depois de um pedido, a diferença é o custo real em créditos.
export async function GET(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": need("ELEVENLABS_API_KEY") }, cache: "no-store" });
    if (!res.ok) throw new Error(`Assinatura (${res.status})`);
    const d = await res.json();
    return Response.json({ used: d.character_count ?? null, limit: d.character_limit ?? null, tier: d.tier ?? null, at: Date.now() });
  } catch (e) {
    return fail(e);
  }
}
