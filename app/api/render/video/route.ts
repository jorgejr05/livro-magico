import { fail } from "@/lib/server";
import { r2Get } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 60;

// Entrega o MP4 pronto (o endereço do pedido é um UUID impossível de adivinhar). A mídia sai do R2 em fluxo.
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("job") || "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(new Error("Pedido inválido."), 400);
    const r = await r2Get(`renders/${id}/video.mp4`);
    if (!r) return fail(new Error("Vídeo não encontrado (ele expira em 1 dia)."), 404);
    return new Response(r.body, {
      headers: { "Content-Type": "video/mp4", "Cache-Control": "private, max-age=3600", "Content-Disposition": 'inline; filename="livro.mp4"' },
    });
  } catch (e) {
    return fail(e);
  }
}
