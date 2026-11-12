import { checkAccess, fail } from "@/lib/server";
import { rpc } from "@/lib/supabase";
import { normKey, onlyDigits } from "@/lib/books";

export const runtime = "nodejs";
export const maxDuration = 15;

// "Meus livros": o responsável digita de novo nome + WhatsApp e reencontra os pedidos.
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { name, whatsapp } = await req.json();
    const wa = onlyDigits(String(whatsapp || ""));
    const key = normKey(String(name || ""));
    if (wa.length < 10 || wa.length > 11 || !key) return fail(new Error("Informe o nome e o WhatsApp com DDD."), 400);
    const books = await rpc("find_books", { p_whatsapp: wa, p_key: key });
    return Response.json({ books }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
