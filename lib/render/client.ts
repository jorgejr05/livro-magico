import { getTheme } from "@/lib/themes";
import type { Answers, Result } from "@/lib/types";
import type { Job } from "./scene";

async function put(job: string, name: string, body: Blob, type: string, headers: Record<string, string>) {
  const r = await fetch(`/api/render/upload?job=${job}&name=${name}`, { method: "PUT", headers: { ...headers, "Content-Type": type }, body });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Upload ${name}: ${r.status}`);
}

/** Monta o pedido, envia imagens e áudios, manda o servidor renderizar e devolve o link do MP4. */
export async function createVideo(opts: {
  result: Result;
  answers: Answers;
  jpegs: File[]; // imagens da galeria já em JPEG, na mesma ordem
  headers: Record<string, string>;
  onStage: (s: "enviando" | "montando") => void;
}): Promise<string> {
  const { result, answers, jpegs, headers } = opts;
  const { story } = result;
  const theme = getTheme(answers.themeId);
  const job = crypto.randomUUID();
  const n = story.paginas.length;
  const G = jpegs.length;

  const times = result.narrTimes && result.narrTimes.length === n ? result.narrTimes : null;
  const jobJson: Job = {
    title: story.titulo,
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
    nImages: G,
  };
  // Sem tempos reais da narração: distribui as páginas pela duração (o servidor corrige com a duração real).
  if (!times) jobJson.pages.forEach((p, i) => (p.start = i * 15));

  opts.onStage("enviando");
  await put(job, "job.json", new Blob([JSON.stringify(jobJson)]), "application/json", headers);
  for (let i = 0; i < G; i++) await put(job, `img${i}.jpg`, jpegs[i], "image/jpeg", headers);
  if (result.narrationUrl) await put(job, "narration.mp3", await (await fetch(result.narrationUrl)).blob(), "audio/mpeg", headers);
  if (result.musicUrl) await put(job, "music.mp3", await (await fetch(result.musicUrl)).blob(), "audio/mpeg", headers);

  opts.onStage("montando");
  // A geração leva 1 a 3 minutos. Se a conexão cair (tela apagou), consulta até o vídeo aparecer.
  const run = fetch("/api/render/run", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ job }) });
  try {
    const r = await run;
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || `Erro ${r.status}`);
    return d.url as string;
  } catch (e) {
    for (let i = 0; i < 60; i++) {
      await new Promise((x) => setTimeout(x, 5000));
      try {
        const s = await (await fetch(`/api/render/status?job=${job}`, { headers })).json();
        if (s.ready) return s.url as string;
      } catch {
        /* tenta de novo */
      }
    }
    throw e;
  }
}
