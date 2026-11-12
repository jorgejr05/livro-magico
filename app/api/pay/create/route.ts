import { checkAccess, fail } from "@/lib/server";
import { rpc } from "@/lib/supabase";
import { AsaasError, asaas, asaasEnabled, bookPrice } from "@/lib/asaas";
import { getBook, isPaid, markPaid, paySecret } from "@/lib/books";

export const runtime = "nodejs";
export const maxDuration = 30;

// Gera (ou recupera) a cobrança Pix do livro. Sem ASAAS_API_KEY só funciona no modo teste (PAY_BYPASS=1).
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { id, cpf } = await req.json();
    const b = await getBook(String(id || ""));
    if (!b) return fail(new Error("Livro não encontrado."), 404);
    if (b.status === "expired") return fail(new Error("Este pedido expirou."), 410);
    if (isPaid(b)) return Response.json({ paid: true });

    if (!asaasEnabled()) {
      if (process.env.PAY_BYPASS !== "1") return fail(new Error("Pagamento indisponível no momento."), 503);
      await markPaid(b.id); // modo teste: libera sem cobrar
      return Response.json({ paid: true, test: true });
    }

    let payId = b.asaas_payment_id;
    if (!payId) {
      const c = (await rpc("book_contact", { p_secret: paySecret(), p_id: b.id })) as { name: string; whatsapp: string };
      const cleanCpf = String(cpf || "").replace(/\D/g, "");
      const customer = await asaas("/customers", {
        name: c.name,
        mobilePhone: c.whatsapp,
        externalReference: b.id,
        notificationDisabled: true,
        ...(cleanCpf ? { cpfCnpj: cleanCpf } : {}),
      });
      const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
      const pay = await asaas("/payments", {
        customer: customer.id,
        billingType: "PIX",
        value: bookPrice(),
        dueDate: today,
        description: "Livro Mágico – livro personalizado",
        externalReference: b.id,
      });
      payId = pay.id as string;
      await rpc("book_set_payment", { p_secret: paySecret(), p_id: b.id, p_asaas: payId });
    }
    const qr = await asaas(`/payments/${payId}/pixQrCode`);
    return Response.json({ payload: qr.payload, qr: qr.encodedImage, expiresAt: qr.expirationDate, value: bookPrice() });
  } catch (e) {
    if (e instanceof AsaasError && e.needCpf) return Response.json({ error: e.message, needCpf: true }, { status: 422 });
    return fail(e);
  }
}
