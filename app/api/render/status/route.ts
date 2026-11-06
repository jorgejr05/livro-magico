import { checkAccess, fail, need } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Diz se o vídeo do pedido já está pronto (usado caso a tela tenha dormido durante a geração).
export async function GET(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const id = new URL(req.url).searchParams.get("job") || "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(new Error("Pedido inválido."), 400);
    const url = `${need("SUPABASE_URL").replace(/\/$/, "")}/storage/v1/object/public/renders/${id}/video.mp4`;
    const r = await fetch(url, { method: "HEAD" });
    return Response.json({ ready: r.ok, url: r.ok ? url : null });
  } catch (e) {
    return fail(e);
  }
}
