import { buildJob } from "@/lib/render/job";
import type { Answers, Result, Story } from "@/lib/types";

// Tudo do livro vive no R2 (books/{id}/...). Estas funções leem e geram as peças que faltam, então fechar a página
// no meio não perde nada: ao voltar, só o que falta é gerado.

export type BookInfo = {
  id: string;
  status: "awaiting_payment" | "paid" | "generating" | "done" | "partial" | "failed" | "expired";
  expires_at: string | null;
  child_name: string;
  age: number;
  birth: string | null;
  parents: string;
  theme_id: string;
  custom_theme: string | null;
  loves: string[];
  traits: string[];
  memory: string | null;
  luna_question: string | null;
  luna_answer: string | null;
  photo_count: number;
  manifest: string[];
  guardian_name: string;
  amount: number | null;
  hasPayment: boolean;
};

export type Progress = { story: boolean; images: number; total: number; narration: boolean; music: boolean };

export const assetUrl = (id: string, name: string) => `/api/books/asset?id=${id}&name=${name}`;

export async function getInfo(id: string): Promise<BookInfo> {
  const r = await fetch(`/api/books/get?id=${id}`, { cache: "no-store" });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Livro não encontrado.");
  return d as BookInfo;
}

export function bookAnswers(b: BookInfo): Answers {
  return {
    childName: b.child_name,
    age: b.age,
    birth: b.birth || "",
    parents: b.parents,
    themeId: b.theme_id,
    customTheme: b.custom_theme || "",
    loves: b.loves,
    traits: b.traits,
    memory: b.memory || "",
    lunaQuestion: b.luna_question || "",
    lunaAnswer: b.luna_answer || "",
    consent: true,
  };
}

const readUsage = (r: Response): unknown => {
  try {
    const h = r.headers.get("x-usage");
    return h ? JSON.parse(h) : undefined;
  } catch {
    return undefined;
  }
};

/** Falta alguma peça essencial? (as imagens recusadas pela moderação não contam como falta) */
export function needsWork(b: BookInfo): boolean {
  const have = new Set(b.manifest);
  if (!have.has("story.json") || !have.has("narration.mp3") || !have.has("narr.json") || !have.has("music.mp3")) return true;
  return b.status === "paid" || b.status === "generating";
}

/** Gera só o que falta, guardando cada peça assim que fica pronta. */
export async function runPipeline(b: BookInfo, headers: Record<string, string>, onProgress: (p: Progress) => void): Promise<void> {
  const id = b.id;
  const answers = bookAnswers(b);
  const have = new Set(b.manifest);
  const n = Math.max(1, Math.min(10, b.photo_count));
  const prog: Progress = {
    story: have.has("story.json"),
    images: 0,
    total: n * 2,
    narration: have.has("narration.mp3") && have.has("narr.json"),
    music: have.has("music.mp3"),
  };
  for (let i = 0; i < n; i++) for (const f of ["l", "p"]) if (have.has(`img_${f}${i}.webp`)) prog.images++;
  const push = () => onProgress({ ...prog });
  push();

  const usages: Record<string, unknown> = {};
  const details: Record<string, unknown> = {};
  const errors: string[] = [];
  const events: { step: string; ok: boolean; ms: number; error?: string; usage?: unknown; detail?: unknown }[] = [];
  const ev = (step: string, ok: boolean, since: number, error?: string) =>
    events.push({ step, ok, ms: Date.now() - since, error, usage: usages[step], detail: details[step] });
  const t0 = Date.now();

  const eleven = async () => {
    try {
      const r = await fetch("/api/usage/eleven", { headers, cache: "no-store" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  const elevenBefore = await eleven();
  await fetch("/api/books/start", { method: "POST", headers, body: JSON.stringify({ id }) }).catch(() => {});

  const post = async (url: string, body: unknown, step: string) => {
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    usages[step] = readUsage(r);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || `Erro ${r.status}`);
    details[step] = d.debug;
    return d;
  };

  let story: Story;
  try {
    if (have.has("story.json")) {
      story = (await (await fetch(assetUrl(id, "story.json"))).json()) as Story;
    } else {
      const t = Date.now();
      story = (await post("/api/luna/story", { answers, photoCount: n, book: id }, "story")).story as Story;
      ev("story", true, t);
    }
    prog.story = true;
    push();
  } catch (e) {
    errors.push((e as Error).message);
    events.push({ step: "story", ok: false, ms: Date.now() - t0, error: (e as Error).message });
    await finish("failed", null);
    throw e;
  }

  const imageJobs = async () => {
    const todo: { i: number; f: "l" | "p" }[] = [];
    for (let i = 0; i < n; i++) for (const f of ["p", "l"] as const) if (!have.has(`img_${f}${i}.webp`)) todo.push({ i, f });
    let cursor = 0;
    const worker = async () => {
      while (cursor < todo.length) {
        const { i, f } = todo[cursor++];
        const step = `image_${f}${i + 1}`;
        const t = Date.now();
        try {
          await post("/api/generate/image", { book: id, idx: i, fmt: f, photoIdx: i, scene: story.cenas[i], themeId: answers.themeId, customTheme: answers.customTheme }, step);
          ev(step, true, t);
        } catch (e) {
          errors.push(`Imagem ${i + 1} (${f === "p" ? "vertical" : "horizontal"}): ${(e as Error).message}`);
          ev(step, false, t, (e as Error).message);
        }
        prog.images++;
        push();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  };

  const narrationJob = async () => {
    if (prog.narration) return;
    const t = Date.now();
    try {
      await post("/api/generate/narration", { book: id, pages: story.paginas.map((p) => p.fala || p.texto) }, "narration");
      ev("narration", true, t);
    } catch (e) {
      errors.push(`Narração: ${(e as Error).message}`);
      ev("narration", false, t, (e as Error).message);
    }
    prog.narration = true;
    push();
  };

  const musicJob = async () => {
    const t = Date.now();
    if (!prog.music) {
      try {
        await post("/api/generate/music", { book: id, letra: story.letra, estilo: story.estilo_musical }, "music");
        ev("music", true, t);
      } catch (e) {
        errors.push(`Música: ${(e as Error).message}`);
        ev("music", false, t, (e as Error).message);
        prog.music = true;
        push();
        return;
      }
    }
    prog.music = true;
    push();
    if (!have.has("lyric.json")) {
      try {
        await post("/api/generate/lyrics-sync", { book: id, letra: story.letra }, "lyrics_sync");
        ev("lyrics_sync", true, t);
      } catch {
        /* segue com a estimativa de tempo dos versos */
      }
    }
  };

  await Promise.all([imageJobs(), narrationJob(), musicJob()]);

  async function finish(status: string, st: Story | null) {
    const elevenAfter = await eleven();
    await fetch("/api/orders/finish", {
      method: "POST",
      headers,
      body: JSON.stringify({ id, status, story: st, errors, events, totalMs: Date.now() - t0, usage: { eleven_before: elevenBefore, eleven_after: elevenAfter } }),
    }).catch(() => {});
  }
  await finish(errors.length ? "partial" : "done", story);
}

/** Monta o resultado a partir do que está guardado (áudios viram blob para o Safari tocar sem "range"). */
export async function loadResult(id: string): Promise<{ result: Result; info: BookInfo; answers: Answers }> {
  const info = await getInfo(id);
  const have = new Set(info.manifest);
  const json = async <T,>(name: string): Promise<T | null> => (have.has(name) ? ((await (await fetch(assetUrl(id, name))).json()) as T) : null);
  const story = await json<Story>("story.json");
  if (!story) throw new Error("O livro ainda não tem roteiro.");
  const narrTimes = await json<NonNullable<Result["narrTimes"]>>("narr.json");
  const lyricStarts = await json<number[]>("lyric.json");
  const n = story.cenas.length;
  const images: (string | null)[] = [];
  const imagesP: (string | null)[] = [];
  for (let i = 0; i < n; i++) {
    const l = have.has(`img_l${i}.webp`) ? assetUrl(id, `img_l${i}.webp`) : null;
    const p = have.has(`img_p${i}.webp`) ? assetUrl(id, `img_p${i}.webp`) : null;
    images.push(l ?? p); // se um formato falhou, usa o outro (a tela recorta para caber)
    imagesP.push(p ?? l);
  }
  const blobUrl = async (name: string) => (have.has(name) ? URL.createObjectURL(await (await fetch(assetUrl(id, name))).blob()) : null);
  const [narrationUrl, musicUrl] = await Promise.all([blobUrl("narration.mp3"), blobUrl("music.mp3")]);
  const answers = bookAnswers(info);
  const result: Result = { story, images, imagesP, narrationUrl, musicUrl, narrTimes, lyricStarts, errors: [], photoProblem: images.some((x) => !x) };
  return { result, info, answers };
}

/** Guarda o job.json (textos e tempos) que o servidor usa para montar o MP4. */
export async function ensureJob(info: BookInfo, result: Result, answers: Answers, headers: Record<string, string>): Promise<void> {
  if (info.manifest.includes("job.json")) return;
  const G = result.images.filter(Boolean).length;
  const job = buildJob(result, answers, G);
  await fetch(`/api/books/asset?id=${info.id}&name=job.json`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(job) });
}

/** Monta o MP4 (h = 16:9, v = 9:16) no servidor e devolve o arquivo. Se a conexão cair, consulta até aparecer. */
export async function makeVideo(id: string, format: "h" | "v", headers: Record<string, string>, title: string): Promise<File> {
  const name = `video_${format}.mp4`;
  const fetchFile = async () => new File([await (await fetch(assetUrl(id, name))).blob()], `${title.replace(/[^\p{L}\p{N}]+/gu, "-")}-${format === "v" ? "celular" : "tv"}.mp4`, { type: "video/mp4" });
  if ((await getInfo(id)).manifest.includes(name)) return fetchFile();
  try {
    const r = await fetch("/api/render/run", { method: "POST", headers, body: JSON.stringify({ book: id, format }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Erro ${r.status}`);
  } catch (e) {
    for (let i = 0; i < 60; i++) {
      await new Promise((x) => setTimeout(x, 5000));
      try {
        if ((await getInfo(id)).manifest.includes(name)) return fetchFile();
      } catch {
        /* tenta de novo */
      }
    }
    throw e;
  }
  return fetchFile();
}
