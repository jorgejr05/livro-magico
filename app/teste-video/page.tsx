"use client";
import { useRef, useState } from "react";

const PROMPT_PADRAO =
  "The child from the photo happily plays in a colorful magical theme world with friendly generic cartoon animal friends, gentle camera movement, joyful smile, soft lighting, children's storybook animation style. Safe, wholesome, no text.";

async function toDataUrl(file: File, max = 1024): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

export default function TesteVideo() {
  const [img, setImg] = useState("");
  const [prompt, setPrompt] = useState(PROMPT_PADRAO);
  const [dur, setDur] = useState(5);
  const [log, setLog] = useState<string[]>([]);
  const [video, setVideo] = useState("");
  const [busy, setBusy] = useState(false);
  const stop = useRef(false);
  const add = (m: string) => setLog((l) => [...l, m]);

  async function run() {
    setBusy(true); setVideo(""); setLog([]); stop.current = false;
    try {
      add("Enviando…");
      const r = await fetch("/api/video/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: img, prompt, duration: dur }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "falhou");
      add("Pedido: " + j.request_id + " (" + j.status + ")");
      for (let i = 0; i < 90 && !stop.current; i++) {
        await new Promise((x) => setTimeout(x, 5000));
        const s = await (await fetch("/api/video/status?id=" + j.request_id)).json();
        add(`${(i + 1) * 5}s: ${s.status || s.error}`);
        if (s.status === "completed") { setVideo(s.video?.url || ""); if (!s.video?.url) add(JSON.stringify(s).slice(0, 400)); break; }
        if (["failed", "nsfw", "canceled"].includes(s.status) || s.error) { add("Fim: " + (s.error || s.status)); break; }
      }
    } catch (e: any) { add("Erro: " + e.message); }
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Teste de vídeo (Higgsfield)</h1>
      <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImg(await toDataUrl(f)); }} />
      {img && <img src={img} alt="" style={{ width: 160, margin: "10px 0", borderRadius: 12 }} />}
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} style={{ width: "100%", border: "1px solid #ccc", borderRadius: 8, padding: 8 }} />
      <label>Duração: {dur}s <input type="range" min={2} max={15} value={dur} onChange={(e) => setDur(+e.target.value)} /></label>
      <div><button disabled={!img || busy} onClick={run} style={{ padding: "10px 20px", background: "#111", color: "#fff", borderRadius: 999, opacity: !img || busy ? 0.5 : 1 }}>{busy ? "Gerando…" : "Gerar vídeo"}</button></div>
      <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
      {video && <video src={video} controls loop autoPlay muted playsInline style={{ width: "100%", borderRadius: 12 }} />}
    </main>
  );
}
