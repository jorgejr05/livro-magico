import { billingHeaders, checkAccess, fail, jsonUsage, need } from "@/lib/server";

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
    const SEP = "\n\n";
    const full = texts.join(SEP);
    if (full.length < 20 || full.length > 3500) return fail(new Error("Texto de narração inválido."), 400);

    const voice = process.env.ELEVEN_VOICE_ID || "5EtawPduB139avoMLQgH";
    const stripTags = (t: string) => t.replace(/\[[^\]]*\]/g, "").replace(/ +/g, " ");
    const tagged = (m: string) => m === "eleven_v4" || m === "eleven_v3";
    const call = (model: string) =>
      fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_96`, {
        method: "POST",
        headers: { "xi-api-key": need("ELEVENLABS_API_KEY"), "Content-Type": "application/json" },
        body: JSON.stringify({
          // v4/v3 interpretam as tags de emoção; os modelos antigos leriam as tags em voz alta, então saem.
          text: tagged(model) ? full : stripTags(full),
          model_id: model,
          language_code: "pt",
          // v4/v3: a emoção vem das tags (sem style/speed). Antigos: mais variação e estilo.
          voice_settings: tagged(model)
            ? { stability: 0.5 }
            : { stability: 0.4, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true, speed: 0.95 },
        }),
      });
    // tenta o modelo da Antonella (v4), depois v3, depois o estável
    let res!: Response;
    let used = "";
    for (const m of [process.env.ELEVEN_TTS_MODEL || "eleven_v4", "eleven_v3", "eleven_multilingual_v2"]) {
      res = await call(m);
      used = m;
      if (res.ok || res.status >= 500 || res.status === 401) break;
    }
    if (!res.ok) throw new Error(`Narração falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const al: Align | undefined = data.alignment || data.normalized_alignment;
    if (!data.audio_base64 || !al) throw new Error("A narração veio sem marcação de tempo.");

    // Tempo de cada palavra (sem contar as tags). Usa o deslocamento exato no texto enviado.
    const S = al.character_start_times_seconds;
    const E = al.character_end_times_seconds;
    const sent = tagged(used) ? full : stripTags(full);
    const exact = al.characters.length === sent.length;
    let pageOffset = 0;
    const out = texts.map((raw) => {
      const t = tagged(used) ? raw : stripTags(raw);
      const words: { s: number; e: number }[] = [];
      let pageStart = -1;
      let pageEnd = 0;
      let i = 0;
      while (i < t.length) {
        // pula espaços e tags "[...]"
        if (/\s/.test(t[i])) { i++; continue; }
        if (t[i] === "[") { const close = t.indexOf("]", i); i = close < 0 ? t.length : close + 1; continue; }
        let j = i;
        while (j < t.length && !/\s/.test(t[j]) && t[j] !== "[") j++;
        const a0 = Math.min(al.characters.length - 1, pageOffset + i);
        const b0 = Math.min(al.characters.length - 1, pageOffset + j - 1);
        const s0 = exact ? S[a0] : (words.length ? pageEnd : S[0] ?? 0);
        const e0 = exact ? E[b0] : s0 + 0.3;
        words.push({ s: s0 ?? pageEnd, e: e0 ?? s0 ?? pageEnd });
        if (pageStart < 0) pageStart = s0 ?? 0;
        pageEnd = e0 ?? s0 ?? pageEnd;
        i = j;
      }
      pageOffset += t.length + SEP.length;
      return { start: Math.max(0, pageStart), end: pageEnd, words };
    });
    return jsonUsage({ audio: data.audio_base64, pages: out }, {
      provider: "elevenlabs-tts",
      model: used,
      chars_sent: sent.length,
      chars_with_tags: full.length,
      audio_seconds: al.character_end_times_seconds[al.character_end_times_seconds.length - 1] ?? null,
      headers: billingHeaders(res),
    });
  } catch (e) {
    return fail(e);
  }
}
