import { checkAccess, fail, jsonUsage, luna } from "@/lib/server";
import { profileText, storySystem } from "@/lib/prompts";
import type { Answers, Story } from "@/lib/types";
import { requirePaid, saveAsset } from "@/lib/books";

export const runtime = "nodejs";
export const maxDuration = 120;

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { answers, photoCount, book } = (await req.json()) as { answers: Answers; photoCount: number; book: string };
    await requirePaid(book);
    const n = Math.max(1, Math.min(10, Number(photoCount) || 1));
    if (!answers?.childName || !answers.consent) return fail(new Error("Dados ou consentimento ausentes."), 400);

    const { out: raw, usage } = await luna(storySystem(n), profileText(answers));

    // Validação mínima: o resto do app assume este formato.
    const paginas = (Array.isArray(raw?.paginas) ? raw.paginas : []).slice(0, 4).map((p: any, i: number) => ({
      capitulo: s(p?.capitulo, 60),
      texto: s(p?.texto, 400),
      foto: Math.min(n - 1, Math.max(0, Number.isInteger(p?.foto) ? p.foto : i % n)),
      legenda: s(p?.legenda, 80),
      fala: s(p?.fala, 800),
    })).map((p: any) => {
      // A fala (com tags de emoção) só vale se, sem as tags, tiver as mesmas palavras do texto; senão narra o texto puro.
      const clean = p.fala.replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter(Boolean);
      const base = p.texto.split(/\s+/).filter(Boolean);
      return { ...p, fala: clean.length === base.length ? p.fala : p.texto };
    });
    const letra = (Array.isArray(raw?.letra) ? raw.letra : []).map((v: unknown) => s(v, 120)).filter(Boolean);
    const cenas = (Array.isArray(raw?.cenas) ? raw.cenas : []).map((v: unknown) => s(v, 400));
    if (paginas.length < 2 || letra.length < 4) throw new Error("A Luna devolveu uma história incompleta. Tente de novo.");
    while (cenas.length < n) cenas.push(cenas[cenas.length - 1] || "the child on a magical adventure");

    const story: Story = {
      titulo: s(raw?.titulo, 80) || `A Aventura de ${answers.childName}`,
      paginas,
      letra,
      estilo_musical: s(raw?.estilo_musical, 300),
      cenas: cenas.slice(0, n),
      cartao_final: {
        titulo: s(raw?.cartao_final?.titulo, 80) || `Feliz aniversário, ${answers.childName}!`,
        subtitulo: s(raw?.cartao_final?.subtitulo, 100) || `${answers.age} aninhos de amor e coragem`,
      },
    };
    await saveAsset(book, "story.json", new TextEncoder().encode(JSON.stringify(story)));
    return jsonUsage({ story }, usage, { system: storySystem(n), user: profileText(answers), raw_output: raw });
  } catch (e) {
    return fail(e);
  }
}
