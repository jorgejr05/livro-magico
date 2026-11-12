import { checkAccess, fail } from "@/lib/server";
import { ASSET, getBook, isPaid, loadAsset, saveAsset, UUID } from "@/lib/books";

export const runtime = "nodejs";
export const maxDuration = 60;

const TYPE: Record<string, string> = { jpg: "image/jpeg", webp: "image/webp", mp3: "audio/mpeg", json: "application/json", mp4: "video/mp4" };

// Entrega um arquivo do livro (o endereço tem um UUID impossível de adivinhar). Sai do R2 em fluxo.
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const id = u.searchParams.get("id") || "";
    const name = u.searchParams.get("name") || "";
    if (!UUID.test(id) || !ASSET.test(name)) return fail(new Error("Pedido inválido."), 400);
    const b = await getBook(id);
    if (!b || b.status === "expired") return fail(new Error("Livro não encontrado ou expirado."), 404);
    const r = await loadAsset(id, name);
    if (!r) return fail(new Error("Arquivo não encontrado."), 404);
    const ext = name.split(".").pop() || "";
    return new Response(r.body, { headers: { "Content-Type": TYPE[ext] || "application/octet-stream", "Cache-Control": "private, max-age=600" } });
  } catch (e) {
    return fail(e);
  }
}

// O navegador só envia as fotos (antes e depois do pagamento) e o job.json (depois). O resto o servidor grava.
export async function PUT(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const u = new URL(req.url);
    const id = u.searchParams.get("id") || "";
    const name = u.searchParams.get("name") || "";
    if (!UUID.test(id) || !/^(photo\d{1,2}\.jpg|job\.json)$/.test(name)) return fail(new Error("Parâmetros inválidos."), 400);
    const b = await getBook(id);
    if (!b || b.status === "expired") return fail(new Error("Livro não encontrado."), 404);
    if (name === "job.json" ? !isPaid(b) : !(b.status === "awaiting_payment" || isPaid(b))) return fail(new Error("Envio não permitido."), 403);
    const body = await req.arrayBuffer();
    if (!body.byteLength || body.byteLength > 4_300_000) return fail(new Error("Arquivo vazio ou grande demais."), 400);
    await saveAsset(id, name, body);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
