import { need } from "@/lib/server";
import { PAID_STATUS, asaas, bookPrice } from "@/lib/asaas";
import { getBook, markPaid } from "@/lib/books";

export const runtime = "nodejs";
export const maxDuration = 30;

// Configure no Asaas: URL https://SEU-DOMINIO/api/asaas/webhook, eventos PAYMENT_RECEIVED e PAYMENT_CONFIRMED,
// e o "token de autenticação" igual à variável ASAAS_WEBHOOK_TOKEN.
export async function POST(req: Request) {
  if (req.headers.get("asaas-access-token") !== need("ASAAS_WEBHOOK_TOKEN")) return new Response("unauthorized", { status: 401 });
  try {
    const body = await req.json();
    const payId = body?.payment?.id;
    if (!/^PAYMENT_(RECEIVED|CONFIRMED)$/.test(String(body?.event)) || typeof payId !== "string") return Response.json({ ok: true });
    // Não confia no corpo: confere o pagamento direto na API do Asaas.
    const p = await asaas(`/payments/${payId}`);
    const b = await getBook(String(p.externalReference || ""));
    if (b && b.asaas_payment_id === payId && PAID_STATUS.includes(p.status) && Number(p.value) >= bookPrice() - 0.01) await markPaid(b.id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true }); // sempre 200 para o Asaas não pausar a fila; o status consulta por conta própria
  }
}
