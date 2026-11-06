import { checkAccess, fail, need } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 120;

type Align = { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };

// Recebe as páginas, narra tudo e devolve o áudio + o tempo real de cada palavra (ElevenLabs with-timestamps).
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { pages } = await req.json();
    if (!Array.isArray(pages) || pages.length < 1 || pages.length > 20) return fail(new Error("Páginas inválidas."), 400);
    const texts: string[] = pages.map((p: unknown) => String(p).trim());
    const full = texts.join("\n\n");
    if (full.length < 20 || full.length > 2800) return fail(new Error("Texto de narração inválido."), 400);

    const voice = process.env.ELEVEN_VOICE_ID || "5EtawPduB139avoMLQgH";
    const call = (model: string) =>
      fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_96`, {
        method: "POST",
        headers: { "xi-api-key": need("ELEVENLABS_API_KEY"), "Content-Type": "application/json" },
        body: JSON.stringify({
          text: full,
          model_id: model,
          language_code: "pt",
          // mais variação e estilo = leitura calorosa e expressiva, não monótona
          voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true, speed: 0.95 },
        }),
      });
    // tenta o modelo da Antonella (v4), depois v3, depois o estável
    let res!: Response;
    for (const m of [process.env.ELEVEN_TTS_MODEL || "eleven_v4", "eleven_v3", "eleven_multilingual_v2"]) {
      res = await call(m);
      if (res.ok || res.status >= 500 || res.status === 401) break;
    }
    if (!res.ok) throw new Error(`Narração falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const al: Align | undefined = data.alignment || data.normalized_alignment;
    if (!data.audio_base64 || !al) throw new Error("A narração veio sem marcação de tempo.");

    // Mapeia caractere -> tempo e monta o tempo de cada palavra de cada página.
    const chars = al.characters;
    const S = al.character_start_times_seconds;
    const E = al.character_end_times_seconds;
    let cursor = 0;
    const out = texts.map((t) => {
      const words: { s: number; e: number }[] = [];
      let pageStart = -1;
      let pageEnd = 0;
      for (const w of t.split(/\s+/).filter(Boolean)) {
        // avança até o primeiro caractere da palavra
        while (cursor < chars.length && /\s/.test(chars[cursor])) cursor++;
        const a = Math.min(cursor, chars.length - 1);
        cursor = Math.min(chars.length, cursor + w.length);
        const b = Math.max(a, cursor - 1);
        const s = S[a] ?? pageEnd;
        const e = E[b] ?? s;
        words.push({ s, e });
        if (pageStart < 0) pageStart = s;
        pageEnd = e;
      }
      return { start: Math.max(0, pageStart), end: pageEnd, words };
    });
    return Response.json({ audio: data.audio_base64, pages: out }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
