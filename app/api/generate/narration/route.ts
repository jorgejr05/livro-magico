import { checkAccess, fail, need } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { text } = await req.json();
    if (typeof text !== "string" || text.length < 20 || text.length > 2500) {
      return fail(new Error("Texto de narração inválido."), 400);
    }
    const voice = process.env.ELEVEN_VOICE_ID || "cjVigY5qzO86Huf0OWal";
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": need("ELEVENLABS_API_KEY"), "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: process.env.ELEVEN_TTS_MODEL || "eleven_multilingual_v2",
        }),
      },
    );
    if (!res.ok) throw new Error(`Narração falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
