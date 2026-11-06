import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fail } from "@/lib/server";
import { audioDuration, renderVideo } from "@/lib/render/server";
import type { Job } from "@/lib/render/scene";

export const runtime = "nodejs";
export const maxDuration = 120;

// Autoteste do gerador de vídeo: imagens e áudio sintéticos, sem dados de ninguém.
export async function GET() {
  const t0 = Date.now();
  try {
    const { createCanvas, GlobalFonts } = await import("@napi-rs/canvas");
    const dir = await mkdtemp(path.join(os.tmpdir(), "selftest-"));
    const imageFiles: string[] = [];
    for (let i = 0; i < 3; i++) {
      const c = createCanvas(1024, 1024);
      const g: any = c.getContext("2d");
      g.fillStyle = ["#e07a5f", "#3d405b", "#81b29a"][i];
      g.fillRect(0, 0, 1024, 1024);
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(512, 512, 200, 0, Math.PI * 2);
      g.fill();
      const f = path.join(dir, `img${i}.jpg`);
      await writeFile(f, c.toBuffer("image/jpeg", 85));
      imageFiles.push(f);
    }
    // áudios de teste gerados pelo próprio ffmpeg
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ff = require("ffmpeg-static") as string;
    const mk = (out: string, freq: number, sec: number) =>
      new Promise<void>((res, rej) => {
        const p = spawn(ff, ["-y", "-f", "lavfi", "-i", `sine=f=${freq}:d=${sec}`, "-c:a", "libmp3lame", out]);
        p.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg sem libmp3lame ou falhou"))));
        p.on("error", rej);
      });
    const narr = path.join(dir, "narration.mp3");
    const mus = path.join(dir, "music.mp3");
    await mk(narr, 440, 12);
    await mk(mus, 660, 10);

    const texto = "Era uma vez uma ilha cheia de sol, onde o mar sussurrava segredos para quem sabia escutar.";
    const words = texto.split(" ");
    const job: Job = {
      title: "Teste do Livro Mágico",
      age: 3,
      theme: { from: "#0b6e7a", to: "#06303d", accent: "#f4c766" },
      pages: [0, 1].map((i) => ({
        capitulo: i ? "Segunda página" : "A ilha de sol",
        texto,
        start: i * 6,
        words: words.map((_, k) => ({ s: i * 6 + k * 0.3, e: i * 6 + k * 0.3 + 0.25 })),
        imgs: [i, i + 1],
      })),
      letra: ["Parabéns, parabéns", "Que alegria, que luz", "Muito amor para você", "Feliz aniversário"],
      lyricStarts: null,
      cartao: { titulo: "Feliz aniversário!", subtitulo: "3 aninhos de amor" },
      nImages: 3,
    };
    const out = await renderVideo({ dir, job, imageFiles, narrationFile: narr, musicFile: mus });
    const size = (await stat(out)).size;
    return Response.json({
      ok: true,
      mp4Bytes: size,
      seconds: await audioDuration(out),
      fonts: GlobalFonts.families.map((f: any) => f.family).filter((n: string) => /poppins|lora/i.test(n)),
      ms: Date.now() - t0,
    });
  } catch (e) {
    return fail(e);
  }
}
