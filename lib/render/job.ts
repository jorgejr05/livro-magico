import { getTheme } from "@/lib/themes";
import type { Answers, Result } from "@/lib/types";
import type { Job } from "./scene";

/** Dados do livro-vídeo a partir do resultado: usado na tela e no servidor de vídeo. */
export function buildJob(result: Result, answers: Answers, G: number): Job {
  const { story } = result;
  const theme = getTheme(answers.themeId);
  const n = story.paginas.length;
  const times = result.narrTimes && result.narrTimes.length === n ? result.narrTimes : null;
  const job: Job = {
    title: story.titulo,
    childName: answers.childName,
    age: Number(answers.age) || 0,
    theme: { from: theme.colors.from, to: theme.colors.to, accent: theme.colors.accent },
    pages: story.paginas.map((p, i) => {
      const s = Math.floor((i * G) / n);
      const e = Math.max(Math.floor(((i + 1) * G) / n), s + 1);
      const imgs = Array.from({ length: Math.max(0, Math.min(e, G) - s) }, (_, k) => s + k);
      return {
        capitulo: p.capitulo,
        texto: p.texto,
        start: times ? times[i].start : 0,
        words: times && times[i].words.length === p.texto.split(/\s+/).filter(Boolean).length ? times[i].words : null,
        imgs: imgs.length ? imgs : [0],
      };
    }),
    letra: story.letra,
    lyricStarts: result.lyricStarts && result.lyricStarts.length === story.letra.length ? result.lyricStarts : null,
    cartao: story.cartao_final,
    nImages: Math.max(1, G),
  };
  if (!times) job.pages.forEach((p, i) => (p.start = i * 15));
  return job;
}
