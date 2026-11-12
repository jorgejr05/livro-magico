import { checkAccess, fail } from "@/lib/server";
import { rpc } from "@/lib/supabase";
import { normKey, onlyDigits } from "@/lib/books";
import { bookPrice } from "@/lib/asaas";

export const runtime = "nodejs";
export const maxDuration = 30;

// Cria o livro (pedido) aguardando pagamento, com o responsável identificado por nome + WhatsApp.
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { answers: a, guardian, whatsapp, photoCount } = await req.json();
    const wa = onlyDigits(String(whatsapp || ""));
    if (wa.length < 10 || wa.length > 11) return fail(new Error("Informe o WhatsApp com DDD."), 400);
    if (String(guardian || "").trim().length < 2) return fail(new Error("Informe o nome do responsável."), 400);
    if (!a?.consent) return fail(new Error("Consentimento dos responsáveis ausente."), 400);
    const id = await rpc("create_book", {
      p: {
        child_name: a.childName, age: a.age, birth: a.birth, parents: a.parents, theme_id: a.themeId, custom_theme: a.customTheme,
        loves: a.loves, traits: a.traits, memory: a.memory, luna_question: a.lunaQuestion, luna_answer: a.lunaAnswer,
        consent: true, photo_count: photoCount, guardian_name: String(guardian).trim(), whatsapp: wa, guardian_key: normKey(String(guardian)),
        amount: bookPrice(),
      },
    });
    return Response.json({ id });
  } catch (e) {
    return fail(e);
  }
}
