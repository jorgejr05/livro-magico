import { fail } from "@/lib/server";
import { PAID_STATUS, asaas, asaasEnabled } from "@/lib/asaas";
import { getBook, isPaid, markPaid } from "@/lib/books";

export const runtime = "nodejs";
export const maxDuration = 20;

// A tela de pagamento consulta aqui a cada poucos segundos (o webhook do Asaas também libera, mas isto não depende dele).
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    let b = await getBook(id);
    if (!b) return fail(new Error("Livro não encontrado."), 404);
    if (!isPaid(b) && b.asaas_payment_id && asaasEnabled()) {
      const p = await asaas(`/payments/${b.asaas_payment_id}`);
      if (PAID_STATUS.includes(p.status) && p.externalReference === b.id) {
        await markPaid(b.id);
        b = await getBook(id);
      }
    }
    return Response.json({ paid: Boolean(b && isPaid(b)), status: b?.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
