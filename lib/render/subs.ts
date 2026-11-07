// Legendas: divide cada página em trechos curtos e diz quais palavras já foram faladas.
export type SW = { w: string; s: number; e: number };
export type Chunk = { words: SW[]; start: number; end: number };

const weight = (w: string) => w.length + 1 + (/[.!?…]$/.test(w) ? 6 : 0) + (/[,;:]$/.test(w) ? 2.5 : 0);

/** Palavras com tempo (s, e) em segundos da narração. Sem tempos reais, distribui pelo peso de cada palavra. */
export function timedWords(texto: string, start: number, end: number, words: { s: number; e: number }[] | null): SW[] {
  const toks = texto.split(/\s+/).filter(Boolean);
  if (words && words.length === toks.length) return toks.map((w, i) => ({ w, s: words[i].s, e: words[i].e }));
  const total = toks.reduce((a, w) => a + weight(w), 0) || 1;
  let acc = 0;
  const span = Math.max(1, end - start);
  return toks.map((w) => {
    const s = start + (acc / total) * span;
    acc += weight(w);
    return { w, s, e: start + (acc / total) * span };
  });
}

/** Trechos de leitura: fecham em ponto final ou, se longos, em vírgula; no máximo ~9 palavras. */
export function toChunks(words: SW[]): Chunk[] {
  const out: Chunk[] = [];
  let cur: SW[] = [];
  const flush = () => {
    if (cur.length) out.push({ words: cur, start: cur[0].s, end: cur[cur.length - 1].e });
    cur = [];
  };
  for (const w of words) {
    cur.push(w);
    const strong = /[.!?…]$/.test(w.w);
    const soft = /[,;:]$/.test(w.w) && cur.length >= 5;
    if (strong || soft || cur.length >= 9) flush();
  }
  flush();
  return out;
}
