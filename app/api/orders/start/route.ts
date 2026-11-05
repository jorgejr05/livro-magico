import { checkAccess, fail } from "@/lib/server";
import { rpc } from "@/lib/supabase";
import type { Answers } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// Registra o pedido (respostas + consentimento). Fotos NÃO são gravadas.
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { answers, photoCount } = (await req.json()) as { answers: Answers; photoCount: number };
    if (!answers?.consent || !answers.childName) return fail(new Error("Dados ou consentimento ausentes."), 400);
    const id = await rpc("start_order", {
      p: {
        child_name: answers.childName,
        age: answers.age,
        birth: answers.birth,
        parents: answers.parents,
        theme_id: answers.themeId,
        custom_theme: answers.customTheme,
        loves: answers.loves,
        traits: answers.traits,
        memory: answers.memory,
        luna_question: answers.lunaQuestion,
        luna_answer: answers.lunaAnswer,
        consent: true,
        photo_count: Math.max(1, Math.min(10, Number(photoCount) || 1)),
      },
    });
    return Response.json({ id });
  } catch (e) {
    return fail(e);
  }
}
