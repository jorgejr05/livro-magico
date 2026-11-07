import { checkAccess, dataUrlToBlob, fail, jsonUsage, need } from "@/lib/server";
import { imagePrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

// Uma imagem por chamada: foto de referência + cena -> imagem temática 1024x1024 (qualidade média, webp).
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { photo, scene, themeId, customTheme, consent } = await req.json();
    if (!consent) return fail(new Error("Consentimento dos responsáveis ausente."), 400);
    if (typeof photo !== "string" || typeof scene !== "string") return fail(new Error("Dados inválidos."), 400);

    const photoBlob = dataUrlToBlob(photo);
    const call = (prompt: string) => {
      const form = new FormData();
      form.append("model", process.env.SUNBURST_MODEL || "gpt-image-2.5-sunburst");
      form.append("image", photoBlob, "foto.jpg");
      form.append("prompt", prompt);
      form.append("size", "1024x1024");
      form.append("quality", "medium");
      form.append("output_format", "webp");
      form.append("n", "1");
      return fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${need("OPENAI_API_KEY")}` },
        body: form,
      });
    };
    const base = imagePrompt(String(themeId || ""), String(customTheme || ""), scene);
    let attempts = 1;
    let res = await call(base);
    if (res.status === 400) {
      // Recusa do filtro de segurança: tenta de novo com enquadramento mais fechado e roupa longa.
      const body = await res.text();
      if (!/moderation|safety/i.test(body)) throw new Error(`Sunburst falhou (400): ${body.slice(0, 300)}`);
      attempts = 2;
      res = await call(`${base} Framing: gentle portrait from the chest up, child wearing a cozy long-sleeved outfit and a themed hat or accessory, wholesome family-friendly children's book illustration.`);
      if (res.status === 400) throw new Error("MODERATION: a foto foi recusada pelo filtro de segurança.");
    }
    if (!res.ok) throw new Error(`Sunburst falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("O gerador de imagens não devolveu imagem.");
    const u = data?.usage || {};
    return jsonUsage({ image: `data:image/webp;base64,${b64}` }, {
      provider: "openai-image",
      model: process.env.SUNBURST_MODEL || "gpt-image-2.5-sunburst",
      attempts, // 2 = a primeira foi recusada pela moderação e refeita
      input_tokens: u.input_tokens ?? null,
      input_text_tokens: u.input_tokens_details?.text_tokens ?? null,
      input_image_tokens: u.input_tokens_details?.image_tokens ?? null,
      output_tokens: u.output_tokens ?? null,
      total_tokens: u.total_tokens ?? null,
      photo_bytes: photoBlob.size,
    });
  } catch (e) {
    return fail(e);
  }
}
