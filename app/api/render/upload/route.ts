import { checkAccess, fail, need } from "@/lib/server";

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
    const base = need("SUPABASE_URL").replace(/\/$/, "");
    const res = await fetch(`${base}/storage/v1/object/renders/${job}/${name}`, {
      method: "POST",
      headers: {
        apikey: need("SUPABASE_PUBLISHABLE_KEY"),
        "Content-Type": req.headers.get("content-type") || "application/octet-stream",
        "x-upsert": "false",
      },
      body,
    });
    if (!res.ok) throw new Error(`Upload falhou (${res.status}): ${(await res.text()).slice(0, 200)}`);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
