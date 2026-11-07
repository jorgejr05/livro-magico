import { checkAccess, fail } from "@/lib/server";
import { r2Get } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 30;

// Diz se o vídeo do pedido já está pronto (usado caso a tela tenha dormido durante a geração).
export async function GET(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const id = new URL(req.url).searchParams.get("job") || "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(new Error("Pedido inválido."), 400);
    const r = await r2Get(`renders/${id}/video.mp4`);
    await r?.body?.cancel();
    return Response.json({ ready: Boolean(r), url: r ? `/api/render/video?job=${id}` : null });
  } catch (e) {
    return fail(e);
  }
}
