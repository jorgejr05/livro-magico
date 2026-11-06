import { checkAccess, dataUrlToBlob, fail, need } from "@/lib/server";
import { HF_HOST, HF_MODEL, hfHeaders } from "@/lib/higgsfield";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { image, prompt, duration, model } = await req.json();
    const MODELS = ["wan/v2.7/image-to-video", "kling-video/v2.6/pro/image-to-video", "minimax/hailuo-2.3/standard/image-to-video"];
    const modelId = MODELS.includes(model) ? model : HF_MODEL;
    if (typeof image !== "string" || !image) return fail(new Error("Imagem ausente."), 400);
    let imageUrl = image;
    if (image.startsWith("data:")) {
      // A Higgsfield exige URL pública: sobe a imagem para um bucket público temporário (nome aleatório).
      const blob = dataUrlToBlob(image);
      const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
      const name = `${crypto.randomUUID()}.${ext}`;
      const base = need("SUPABASE_URL").replace(/\/$/, "");
      const up = await fetch(`${base}/storage/v1/object/frames/${name}`, {
        method: "POST",
        headers: { apikey: need("SUPABASE_PUBLISHABLE_KEY"), "Content-Type": blob.type },
        body: blob,
      });
      if (!up.ok) throw new Error(`Upload da imagem falhou (${up.status}): ${(await up.text()).slice(0, 200)}`);
      imageUrl = `${base}/storage/v1/object/public/frames/${name}`;
    }
    const d = Math.min(15, Math.max(2, Number(duration) || 5));
    const res = await fetch(`${HF_HOST}/${modelId}`, {
      method: "POST",
      headers: { ...hfHeaders(), "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt: String(prompt || "").slice(0, 1500),
        ...(modelId.startsWith("kling")
          ? { duration: d > 7 ? 10 : 5, sound: "off", aspect_ratio: "1:1" }
          : modelId.startsWith("minimax")
            ? { duration: d > 7 ? 10 : 6 }
            : { duration: d, resolution: "720p" }),
      }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Higgsfield (${res.status}): ${text.slice(0, 400)}`);
    return Response.json(JSON.parse(text));
  } catch (e) {
    return fail(e);
  }
}
