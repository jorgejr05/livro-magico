import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkAccess, fail } from "@/lib/server";
import { loadAsset, requirePaid, saveAsset } from "@/lib/books";
import { renderVideo } from "@/lib/render/server";
import type { Job } from "@/lib/render/scene";

export const runtime = "nodejs";
export const maxDuration = 300;

// Monta o MP4 de um livro pago (h = 16:9 para TV/PC, v = 9:16 para celular) a partir dos arquivos guardados no R2.
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { book, format } = await req.json();
    if (format !== "h" && format !== "v") return fail(new Error("Formato inválido."), 400);
    await requirePaid(book);
    const dir = await mkdtemp(path.join(os.tmpdir(), "render-"));

    const get = async (name: string, optional = false): Promise<string | null> => {
      const r = await loadAsset(book, name);
      if (!r) {
        if (optional) return null;
        throw new Error(`Arquivo ausente: ${name}`);
      }
      const f = path.join(dir, name);
      await writeFile(f, Buffer.from(await r.arrayBuffer()));
      return f;
    };

    const job = JSON.parse(await readFile((await get("job.json"))!, "utf8")) as Job;
    const mine = format === "v" ? "p" : "l";
    const other = format === "v" ? "l" : "p";
    const imageFiles: string[] = [];
    for (let i = 0; i < Math.min(10, job.nImages); i++) {
      const f = (await get(`img_${mine}${i}.webp`, true)) || (await get(`img_${other}${i}.webp`, true));
      if (f) imageFiles.push(f);
    }
    const narrationFile = await get("narration.mp3", true);
    const musicFile = await get("music.mp3", true);

    const out = await renderVideo({ dir, job, imageFiles, narrationFile, musicFile, format });
    const name = `video_${format}.mp4`;
    await saveAsset(book, name, await readFile(out));
    return Response.json({ ok: true, name });
  } catch (e) {
    return fail(e);
  }
}
