import { checkAccess, fail, jsonUsage, need } from "@/lib/server";
import { imagePrompt } from "@/lib/prompts";
import { loadAsset, requirePaid, saveAsset } from "@/lib/books";

export const runtime = "nodejs";
export const maxDuration = 120;

// Uma imagem por chamada: foto de referência + cena -> imagem temática 1024x1024 (qualidade média, webp).
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { book, idx, fmt, photoIdx, scene, themeId, customTheme } = await req.json();
    await requirePaid(book); // só livro pago gera imagem (o consentimento já foi exigido ao criar o livro)
    if (typeof scene !== "string" || !Number.isInteger(idx) || !Number.isInteger(photoIdx) || (fmt !== "l" && fmt !== "p")) return fail(new Error("Dados inválidos."), 400);
    const pr = await loadAsset(book, `photo${photoIdx}.jpg`);
    if (!pr) return fail(new Error("Foto não encontrada."), 404);
    const photoBlob = new Blob([await pr.arrayBuffer()], { type: "image/jpeg" });
    const size = fmt === "p" ? "1024x1536" : "1536x1024"; // 9:16 (celular) e 16:9 (TV/PC) aproximados; a tela recorta o excedente
    const call = (prompt: string) => {
      const form = new FormData();
      form.append("model", process.env.SUNBURST_MODEL || "gpt-image-2.5-sunburst");
      form.append("image", photoBlob, "foto.jpg");
      form.append("prompt", prompt);
      form.append("size", size);
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
    const prompts: string[] = [base];
    let attempts = 1;
    let res = await call(base);
    if (res.status === 400) {
      // Recusa do filtro de segurança: tenta de novo com enquadramento mais fechado e roupa longa.
      const body = await res.text();
      if (!/moderation|safety/i.test(body)) throw new Error(`Sunburst falhou (400): ${body.slice(0, 300)}`);
      attempts = 2;
      const safer = `${base} Framing: gentle portrait from the chest up, child wearing a cozy long-sleeved outfit and a themed hat or accessory, wholesome family-friendly children's book illustration.`;
      prompts.push(safer);
      res = await call(safer);
      if (res.status === 400) throw new Error("MODERATION: a foto foi recusada pelo filtro de segurança.");
    }
    if (!res.ok) throw new Error(`Sunburst falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("O gerador de imagens não devolveu imagem.");
    const u = data?.usage || {};
    const name = `img_${fmt}${idx}.webp`;
    await saveAsset(book, name, Buffer.from(b64, "base64"));
    return jsonUsage({ ok: true, name }, {
      provider: "openai-image",
      model: process.env.SUNBURST_MODEL || "gpt-image-2.5-sunburst",
      attempts, // 2 = a primeira foi recusada pela moderação e refeita
      input_tokens: u.input_tokens ?? null,
      input_text_tokens: u.input_tokens_details?.text_tokens ?? null,
      input_image_tokens: u.input_tokens_details?.image_tokens ?? null,
      output_tokens: u.output_tokens ?? null,
      total_tokens: u.total_tokens ?? null,
      photo_bytes: photoBlob.size,
      size,
    }, { prompts, scene, themeId, customTheme, size });
  } catch (e) {
    return fail(e);
  }
}
