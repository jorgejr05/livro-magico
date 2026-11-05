// Reduz a foto no navegador (máx. 1024 px, JPEG) para caber no limite de corpo das funções da Vercel.
export async function fileToResizedDataUrl(file: File, max = 1024, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu processar a foto.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

// Peso de cada palavra para sincronizar o texto com a narração (tamanho + pausa da pontuação).
export function wordWeight(w: string): number {
  return w.length + 1 + (/[.!?…]$/.test(w) ? 6 : /,$/.test(w) ? 2.5 : 0);
}
