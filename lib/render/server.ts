/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { COVER_SEC, FPS, drawFrame, eventTimes, layout, type Job, type Timing } from "./scene";


function ffmpegBin(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require("ffmpeg-static") as string | null;
  if (!p) throw new Error("ffmpeg não encontrado no servidor.");
  return p;
}

function run(cmd: string, args: string[]): Promise<{ code: number; err: string }> {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args);
    let err = "";
    c.stderr.on("data", (d) => { err += d.toString(); if (err.length > 20000) err = err.slice(-20000); });
    c.on("error", reject);
    c.on("close", (code) => resolve({ code: code ?? 1, err }));
  });
}

export async function audioDuration(file: string): Promise<number> {
  const { err } = await run(ffmpegBin(), ["-hide_banner", "-i", file]);
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(err);
  if (!m) throw new Error("Não consegui ler a duração do áudio.");
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export async function renderVideo(opts: {
  dir: string;
  job: Job;
  imageFiles: string[];
  narrationFile: string | null;
  musicFile: string | null;
  format?: "h" | "v"; // h = 16:9 (TV/PC), v = 9:16 (celular)
}): Promise<string> {
  const vertical = opts.format === "v";
  const OUT_W = vertical ? 720 : 1280;
  const OUT_H = vertical ? 1280 : 720;
  const DW = vertical ? 900 : 1600;
  const DH = vertical ? 1600 : 900;
  const { createCanvas, loadImage, GlobalFonts } = await import("@napi-rs/canvas");
  const fonts = path.join(process.cwd(), "assets", "fonts");
  GlobalFonts.registerFromPath(path.join(fonts, "Poppins-Medium.ttf"), "Poppins");
  GlobalFonts.registerFromPath(path.join(fonts, "Poppins-Bold.ttf"), "Poppins");
  GlobalFonts.registerFromPath(path.join(fonts, "Lora-Variable.ttf"), "Lora");

  const { dir, job } = opts;
  const tm: Timing = {
    narrDur: opts.narrationFile ? await audioDuration(opts.narrationFile) : 0,
    musicDur: opts.musicFile ? await audioDuration(opts.musicFile) : 0,
  };
  if (!tm.narrDur && !tm.musicDur) throw new Error("Sem áudio para montar o vídeo.");
  if (!tm.narrDur) tm.narrDur = 0.1;
  if (!tm.musicDur) tm.musicDur = 8;

  const imgs: any[] = [];
  for (const f of opts.imageFiles) imgs.push(await loadImage(await readFile(f)));
  if (!imgs.length) throw new Error("Sem imagens para o vídeo.");

  const times = eventTimes(job, tm);
  const { total, finaleAt } = layout(tm);
  const canvas = createCanvas(OUT_W, OUT_H);
  const ctx: any = canvas.getContext("2d");
  const mk = (w: number, h: number) => createCanvas(w, h);
  const framesDir = path.join(dir, "frames");
  await mkdir(framesDir, { recursive: true });

  const list: string[] = [];
  for (let i = 0; i < times.length; i++) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, OUT_W, OUT_H);
    ctx.setTransform(OUT_W / DW, 0, 0, OUT_H / DH, 0, 0);
    ctx.globalAlpha = 1;
    ctx.shadowColor = "transparent";
    ctx.textAlign = "left";
    drawFrame(ctx, mk, imgs, job, tm, times[i], DW, DH);
    const name = `f${String(i).padStart(4, "0")}.jpg`;
    await writeFile(path.join(framesDir, name), canvas.toBuffer("image/jpeg", 88));
    const next = i + 1 < times.length ? times[i + 1] : total;
    list.push(`file '${path.join(framesDir, name)}'`, `duration ${Math.max(1 / FPS, next - times[i]).toFixed(4)}`);
  }
  list.push(list[list.length - 2]); // o concat exige repetir o último quadro
  const listFile = path.join(dir, "frames.txt");
  await writeFile(listFile, list.join("\n"));

  const out = path.join(dir, "video.mp4");
  const args = ["-y", "-hide_banner", "-f", "concat", "-safe", "0", "-i", listFile];
  const filters: string[] = [];
  const mix: string[] = [];
  let n = 1;
  if (opts.narrationFile) {
    args.push("-i", opts.narrationFile);
    filters.push(`[${n}:a]adelay=${Math.round(COVER_SEC * 1000)}:all=1[a${n}]`);
    mix.push(`[a${n}]`);
    n++;
  }
  if (opts.musicFile) {
    args.push("-i", opts.musicFile);
    filters.push(`[${n}:a]adelay=${Math.round(finaleAt * 1000)}:all=1[a${n}]`);
    mix.push(`[a${n}]`);
    n++;
  }
  filters.push(`${mix.join("")}amix=inputs=${mix.length}:normalize=0:dropout_transition=0[aout]`);
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "0:v", "-map", "[aout]",
    "-vf", `fps=${FPS},format=yuv420p`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "25",
    "-c:a", "aac", "-b:a", "128k",
    "-t", total.toFixed(2),
    "-movflags", "+faststart",
    out,
  );
  const { code, err } = await run(ffmpegBin(), args);
  if (code !== 0) throw new Error(`ffmpeg falhou: ${err.slice(-500)}`);
  return out;
}
