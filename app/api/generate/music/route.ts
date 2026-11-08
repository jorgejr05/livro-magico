import { billingHeaders, checkAccess, fail, need, withUsage } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { letra, estilo } = await req.json();
    if (!Array.isArray(letra) || letra.length < 4 || letra.length > 30) {
      return fail(new Error("Letra inválida."), 400);
    }
    const lyrics = letra.map((v: unknown) => String(v).slice(0, 120)).join("\n");
    const prompt = `${String(estilo || "cheerful kids pop").slice(0, 300)}. Original children's birthday song sung by a warm, cheerful adult female voice in Brazilian Portuguese, clear diction, sing the lyrics exactly in order. Lyrics:\n${lyrics}`;
    const call = (model: string) =>
      fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
        method: "POST",
        headers: { "xi-api-key": need("ELEVENLABS_API_KEY"), "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, music_length_ms: 90000, model_id: model }),
      });
    let res = await call(process.env.ELEVEN_MUSIC_MODEL || "music_v1");
    if (!res.ok && res.status < 500 && process.env.ELEVEN_MUSIC_MODEL) res = await call("music_v1");
    if (!res.ok) throw new Error(`Música falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return withUsage(res.body, {
      provider: "elevenlabs-music",
      model: process.env.ELEVEN_MUSIC_MODEL || "music_v1",
      requested_ms: 90000,
      prompt_chars: prompt.length,
      headers: billingHeaders(res),
    }, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "x-prompt": encodeURIComponent(prompt).slice(0, 4000) } });
  } catch (e) {
    return fail(e);
  }
}
