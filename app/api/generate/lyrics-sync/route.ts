import { checkAccess, fail, need } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

// Transcreve a música gerada (palavras com tempo) e descobre em que segundo começa cada verso da letra.
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const letra: string[] = JSON.parse(String(form.get("letra") || "[]"));
    if (!(audio instanceof Blob) || !letra.length) return fail(new Error("Dados inválidos."), 400);

    const fd = new FormData();
    fd.append("file", audio, "musica.mp3");
    fd.append("model_id", "scribe_v1");
    fd.append("language_code", "por");
    fd.append("timestamps_granularity", "word");
    fd.append("tag_audio_events", "false");
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": need("ELEVENLABS_API_KEY") },
      body: fd,
    });
    if (!res.ok) throw new Error(`Transcrição falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const words: { t: string; s: number; e: number }[] = (data.words || [])
      .filter((w: any) => w.type === "word" && typeof w.start === "number")
      .map((w: any) => ({ t: norm(String(w.text)), s: w.start, e: w.end }))
      .filter((w: any) => w.t);
    if (words.length < 3) throw new Error("Sem palavras reconhecidas na música.");

    // Alinha verso a verso, em ordem, escolhendo a janela de palavras que mais se parece com o verso.
    const starts: number[] = [];
    let p = 0;
    let lastEnd = 0;
    for (const line of letra) {
      const toks = line.split(/\s+/).map(norm).filter(Boolean);
      const m = toks.length || 1;
      let best = -1;
      let bestScore = 0;
      for (let i = p; i <= Math.min(words.length - 1, p + m + 8); i++) {
        const win = words.slice(i, i + m).map((w) => w.t);
        const score = toks.filter((t) => win.includes(t)).length / m;
        if (score > bestScore) { bestScore = score; best = i; }
      }
      if (best >= 0 && bestScore >= 0.4) {
        starts.push(words[best].s);
        lastEnd = words[Math.min(words.length - 1, best + m - 1)].e;
        p = Math.min(words.length, best + m);
      } else {
        starts.push(lastEnd); // não achou: mantém depois do verso anterior
      }
    }
    // garante ordem crescente
    for (let i = 1; i < starts.length; i++) if (starts[i] < starts[i - 1]) starts[i] = starts[i - 1];
    return Response.json({ starts });
  } catch (e) {
    return fail(e);
  }
}
