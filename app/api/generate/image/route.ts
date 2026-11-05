import { checkAccess, dataUrlToBlob, fail, need } from "@/lib/server";
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

    const form = new FormData();
    form.append("model", process.env.SUNBURST_MODEL || "gpt-image-2.5-sunburst");
    form.append("image", dataUrlToBlob(photo), "foto.jpg");
    form.append("prompt", imagePrompt(String(themeId || ""), String(customTheme || ""), scene));
    form.append("size", "1024x1024");
    form.append("quality", "medium");
    form.append("output_format", "webp");
    form.append("n", "1");

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${need("OPENAI_API_KEY")}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Sunburst falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("O gerador de imagens não devolveu imagem.");
    return Response.json({ image: `data:image/webp;base64,${b64}` });
  } catch (e) {
    return fail(e);
  }
}
