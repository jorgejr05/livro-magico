import { fail } from "@/lib/server";
import { getBook } from "@/lib/books";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    const b = await getBook(id);
    if (!b) return fail(new Error("Livro não encontrado."), 404);
    const { asaas_payment_id, ...pub } = b;
    return Response.json({ ...pub, hasPayment: Boolean(asaas_payment_id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
