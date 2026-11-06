import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkAccess, fail, need } from "@/lib/server";
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
    const base = need("SUPABASE_URL").replace(/\/$/, "");
    const pub = `${base}/storage/v1/object/public/renders/${id}`;
    const dir = await mkdtemp(path.join(os.tmpdir(), "render-"));

    const get = async (name: string, optional = false): Promise<string | null> => {
      const r = await fetch(`${pub}/${name}`);
      if (!r.ok) {
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

    const video = await readFile(out);
    const up = await fetch(`${base}/storage/v1/object/renders/${id}/video.mp4`, {
      method: "POST",
      headers: { apikey: need("SUPABASE_PUBLISHABLE_KEY"), "Content-Type": "video/mp4", "x-upsert": "true" },
      body: video,
    });
    if (!up.ok) throw new Error(`Não consegui guardar o vídeo (${up.status}): ${(await up.text()).slice(0, 200)}`);
    return Response.json({ url: `${pub}/video.mp4` });
  } catch (e) {
    return fail(e);
  }
}
