import { checkAccess, fail } from "@/lib/server";
import { HF_HOST, HF_MODEL, hfHeaders } from "@/lib/higgsfield";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { image, prompt, duration } = await req.json();
    if (typeof image !== "string" || !image) return fail(new Error("Imagem ausente."), 400);
    const d = Math.min(15, Math.max(2, Number(duration) || 5));
    const res = await fetch(`${HF_HOST}/${HF_MODEL}`, {
      method: "POST",
      headers: { ...hfHeaders(), "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        image_url: image, // URL pública ou data URI (o teste diz se data URI é aceito)
        prompt: String(prompt || "").slice(0, 1500),
        duration: d,
        resolution: "720p",
      }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Higgsfield (${res.status}): ${text.slice(0, 400)}`);
    return Response.json(JSON.parse(text));
  } catch (e) {
    return fail(e);
  }
}
