import { checkAccess, fail } from "@/lib/server";
import { r2Put } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;
const NAME = /^(img\d{1,2}\.jpg|narration\.mp3|music\.mp3|job\.json)$/;

// Recebe um arquivo do navegador e guarda na pasta temporária do pedido (a função de render lê de lá).
export async function PUT(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const u = new URL(req.url);
    const job = u.searchParams.get("job") || "";
    const name = u.searchParams.get("name") || "";
    if (!UUID.test(job) || !NAME.test(name)) return fail(new Error("Parâmetros inválidos."), 400);
    const body = await req.arrayBuffer();
    if (!body.byteLength || body.byteLength > 4_300_000) return fail(new Error("Arquivo vazio ou grande demais."), 400);
    await r2Put(`renders/${job}/${name}`, body, req.headers.get("content-type") || "application/octet-stream");
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
