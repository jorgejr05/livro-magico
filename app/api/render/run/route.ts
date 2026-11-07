import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkAccess, fail } from "@/lib/server";
import { r2Get, r2Put } from "@/lib/r2";
import { renderVideo } from "@/lib/render/server";
import type { Job } from "@/lib/render/scene";

export const runtime = "nodejs";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { job: id } = await req.json();
    if (typeof id !== "string" || !UUID.test(id)) return fail(new Error("Pedido inválido."), 400);
    const dir = await mkdtemp(path.join(os.tmpdir(), "render-"));

    const get = async (name: string, optional = false): Promise<string | null> => {
      const r = await r2Get(`renders/${id}/${name}`);
      if (!r) {
        if (optional) return null;
        throw new Error(`Arquivo ausente: ${name}`);
      }
      const f = path.join(dir, name);
      await writeFile(f, Buffer.from(await r.arrayBuffer()));
      return f;
    };

    const jobFile = await get("job.json");
    const job = JSON.parse(await readFile(jobFile!, "utf8")) as Job;
    const imageFiles: string[] = [];
    for (let i = 0; i < Math.min(10, job.nImages); i++) {
      const f = await get(`img${i}.jpg`, true);
      if (f) imageFiles.push(f);
    }
    const narrationFile = await get("narration.mp3", true);
    const musicFile = await get("music.mp3", true);

    const out = await renderVideo({ dir, job, imageFiles, narrationFile, musicFile });

    await r2Put(`renders/${id}/video.mp4`, await readFile(out), "video/mp4");
    return Response.json({ url: `/api/render/video?job=${id}` });
  } catch (e) {
    return fail(e);
  }
}
