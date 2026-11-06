import { makeZip, urlToBytes, type ZipFile } from "@/lib/zip";
import type { Result, Story } from "@/lib/types";

// Livro de leitura em um arquivo só (abre em qualquer navegador, sem internet).
export function bookHtml(story: Story, images: (string | null)[]): string {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const pages = story.paginas
    .map((p) => {
      const img = images[p.foto] ?? images.find(Boolean) ?? null;
      return `<section>${img ? `<img src="${img}" alt="">` : ""}<h2>${esc(p.capitulo)}</h2><p>${esc(p.texto)}</p></section>`;
    })
    .join("");
  const letra = story.letra.map((v) => `<p>${esc(v)}</p>`).join("");
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(story.titulo)}</title><style>body{margin:0;background:#f6efe2;color:#3b2a1a;font-family:Georgia,serif}main{max-width:640px;margin:0 auto;padding:24px}h1{text-align:center}section{margin:32px 0;text-align:center}img{width:100%;border-radius:16px}p{font-size:19px;line-height:1.6}.l p{margin:4px 0;font-size:17px}</style><main><h1>${esc(story.titulo)}</h1>${pages}<section class="l"><h2>A música</h2>${letra}</section><section><h2>${esc(story.cartao_final.titulo)}</h2><p>${esc(story.cartao_final.subtitulo)}</p></section></main></html>`;
}

export async function downloadAll(result: Result): Promise<void> {
  const { story, images } = result;
  const files: ZipFile[] = [];
  const enc = new TextEncoder();
  const safe = story.titulo.replace(/[^\p{L}\p{N} ]/gu, "").trim() || "livro";
  let n = 0;
  for (const img of images) if (img) files.push({ name: `imagens/imagem-${++n}.webp`, data: await urlToBytes(img) });
  if (result.narrationUrl) files.push({ name: "narracao.mp3", data: await urlToBytes(result.narrationUrl) });
  if (result.musicUrl) files.push({ name: "musica.mp3", data: await urlToBytes(result.musicUrl) });
  files.push({ name: "livro.html", data: enc.encode(bookHtml(story, images)) });
  const url = URL.createObjectURL(makeZip(files));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
