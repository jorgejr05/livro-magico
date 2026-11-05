import { checkAccess, fail, luna } from "@/lib/server";
import { FOLLOWUP_SYSTEM, profileText } from "@/lib/prompts";
import type { Answers } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { answers } = (await req.json()) as { answers: Answers };
    if (!answers?.childName) return fail(new Error("Dados incompletos."), 400);
    const out = await luna(FOLLOWUP_SYSTEM, profileText(answers));
    const pergunta = typeof out?.pergunta === "string" ? out.pergunta.slice(0, 200) : "";
    return Response.json({ pergunta });
  } catch (e) {
    return fail(e);
  }
}
