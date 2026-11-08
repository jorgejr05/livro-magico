/* eslint-disable @typescript-eslint/no-explicit-any */
// Livro-vídeo: capa de livro fechado, imagens em tela cheia com legenda só do que está sendo dito/cantado,
// e livro fechado de novo no final. Este módulo decide O QUE aparece em cada instante (stateAt) e desenha em
// canvas 2D (drawFrame), igual no navegador (testes) e no servidor (@napi-rs/canvas).
import { timedWords, toChunks, type Chunk } from "./subs";

export const DW = 1600;
export const DH = 900;
export const COVER_SEC = 7; // abertura animada: capa, título, subtítulo (a narração só começa depois)
export const GAP_SEC = 0.5;
export const TAIL_SEC = 6;
export const FPS = 15;
export const FADE = 0.6;
export const SLIDE_SEC = 6;

export type Job = {
  title: string;
  childName?: string;
  parents?: string;
  birth?: string; // AAAA-MM-DD
  age: number;
  theme: { from: string; to: string; accent: string };
  pages: { capitulo: string; texto: string; start: number; words: { s: number; e: number }[] | null; imgs: number[] }[];
  letra: string[];
  lyricStarts: number[] | null;
  cartao: { titulo: string; subtitulo: string };
  nImages: number;
};
export type Timing = { narrDur: number; musicDur: number };
export type MakeCanvas = (w: number, h: number) => any;

export type SubWord = { w: string; on: boolean; cur: boolean };
export type State = {
  phase: "cover" | "story" | "music" | "end";
  cur: number;
  prev: number;
  mix: number; // 0..1: quanto da imagem atual já apareceu sobre a anterior
  sub: SubWord[] | null;
  subKind: "narr" | "lyric" | null;
};

export function layout(tm: Timing) {
  const narrAt = COVER_SEC;
  const finaleAt = narrAt + tm.narrDur + GAP_SEC;
  const endAt = finaleAt + tm.musicDur;
  return { narrAt, finaleAt, endAt, total: endAt + TAIL_SEC };
}

/* ---------- o que aparece em cada instante ---------- */
type Plan = { chunks: Chunk[]; switches: { t: number; idx: number }[]; lyric: { s: number; e: number }[] };
const plans = new WeakMap<Job, Map<string, Plan>>();

function plan(job: Job, tm: Timing): Plan {
  const key = `${tm.narrDur}|${tm.musicDur}`;
  let m = plans.get(job);
  if (!m) plans.set(job, (m = new Map()));
  const hit = m.get(key);
  if (hit) return hit;
  const { narrAt, finaleAt } = layout(tm);
  const chunks: Chunk[] = [];
  const switches: { t: number; idx: number }[] = [];
  const G = Math.max(1, job.nImages);
  job.pages.forEach((p, i) => {
    const end = i + 1 < job.pages.length ? job.pages[i + 1].start : tm.narrDur;
    chunks.push(...toChunks(timedWords(p.texto, p.start, end, p.words)));
    const k = p.imgs.length || 1;
    for (let j = 0; j < k; j++) switches.push({ t: narrAt + p.start + ((end - p.start) * j) / k, idx: (p.imgs[j] ?? 0) % G });
  });
  if (switches.length) switches[0].t = 0;
  let j = 0;
  for (let t = 0; t < tm.musicDur; t += SLIDE_SEC) switches.push({ t: finaleAt + t, idx: j++ % G });
  const L = job.letra.length;
  const lyric = job.letra.map((_, k) => {
    const s = job.lyricStarts && job.lyricStarts.length === L ? job.lyricStarts[k] : (tm.musicDur * k) / L;
    const nxt = k + 1 < L ? (job.lyricStarts && job.lyricStarts.length === L ? job.lyricStarts[k + 1] : (tm.musicDur * (k + 1)) / L) : tm.musicDur;
    return { s, e: Math.min(nxt, s + 8) };
  });
  const p: Plan = { chunks, switches, lyric };
  m.set(key, p);
  return p;
}

export function stateAt(job: Job, tm: Timing, T: number): State {
  const { narrAt, finaleAt, endAt } = layout(tm);
  const pl = plan(job, tm);
  if (T < narrAt) return { phase: "cover", cur: 0, prev: 0, mix: 1, sub: null, subKind: null };
  if (T >= endAt) return { phase: "end", cur: 0, prev: 0, mix: 1, sub: null, subKind: null };

  let k = 0;
  for (let i = 0; i < pl.switches.length; i++) if (pl.switches[i].t <= T) k = i;
  const cur = pl.switches[k]?.idx ?? 0;
  const prev = k > 0 ? pl.switches[k - 1].idx : cur;
  const mix = k > 0 ? Math.min(1, Math.max(0, (T - pl.switches[k].t) / FADE)) : 1;

  if (T < finaleAt) {
    const tn = T - narrAt;
    let ci = -1;
    for (let i = 0; i < pl.chunks.length; i++) if (pl.chunks[i].start <= tn + 0.04) ci = i;
    let sub: SubWord[] | null = null;
    if (ci >= 0) {
      const c = pl.chunks[ci];
      const next = pl.chunks[ci + 1];
      if (tn <= c.end + 0.7 || (next && next.start - tn < 0.2)) {
        let last = -1;
        c.words.forEach((w, i) => { if (w.s <= tn + 0.02) last = i; });
        sub = c.words.map((w, i) => ({ w: w.w, on: i <= last, cur: i === last && tn <= w.e + 0.12 }));
      }
    }
    return { phase: "story", cur, prev, mix, sub, subKind: "narr" };
  }

  const tmu = T - finaleAt;
  let li = -1;
  for (let i = 0; i < pl.lyric.length; i++) if (pl.lyric[i].s - 0.1 <= tmu) li = i;
  let sub: SubWord[] | null = null;
  if (li >= 0 && tmu <= pl.lyric[li].e) {
    const toks = job.letra[li].split(/\s+/).filter(Boolean);
    const reveal = Math.min(2.2, (pl.lyric[li].e - pl.lyric[li].s) * 0.7);
    const el = tmu - pl.lyric[li].s;
    let last = -1;
    toks.forEach((_, i) => { if (el >= (i / toks.length) * reveal - 0.05) last = i; });
    sub = toks.map((w, i) => ({ w, on: i <= last, cur: i === last && el < reveal + 0.3 }));
  }
  return { phase: "music", cur, prev, mix, sub, subKind: "lyric" };
}

/** Instantes em que o quadro muda (palavras, trechos, trocas de imagem com fusão, versos, capa e fim). */
export function eventTimes(job: Job, tm: Timing): number[] {
  const { narrAt, finaleAt, endAt, total } = layout(tm);
  const pl = plan(job, tm);
  const set = new Set<number>();
  const add = (t: number) => {
    if (t >= 0 && t < total) set.add(Math.round(t * FPS) / FPS);
  };
  [0, narrAt, finaleAt, endAt].forEach(add);
  for (let t = 0; t < COVER_SEC; t += 1 / FPS) add(t); // abertura animada (título, ondas, brilhos)
  pl.chunks.forEach((c) => {
    add(c.end + 0.7);
    c.words.forEach((w) => {
      add(narrAt + w.s);
      add(narrAt + w.e + 0.12);
    });
    add(narrAt + c.start);
    add(narrAt + c.end + 0.7);
  });
  pl.switches.forEach((s, i) => {
    if (i === 0) return;
    for (let t = 0; t <= FADE + 1e-6; t += 1 / FPS) add(s.t + t);
  });
  pl.lyric.forEach((l, k) => {
    const toks = job.letra[k].split(/\s+/).filter(Boolean);
    const reveal = Math.min(2.2, (l.e - l.s) * 0.7);
    toks.forEach((_, i) => add(finaleAt + l.s + (i / toks.length) * reveal));
    add(finaleAt + l.s + reveal + 0.3);
    add(finaleAt + l.e + 0.01);
  });
  return [...set].sort((a, b) => a - b);
}

/* ---------- desenho ---------- */
const SANS = "Poppins, Helvetica, Arial, sans-serif";
const GOLD = "#d9b36a";

function coverDraw(ctx: any, img: any, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

const blurCache = new Map<any, any>();
function blurred(mk: MakeCanvas, img: any) {
  let c = blurCache.get(img);
  if (!c) {
    c = mk(48, 27);
    coverDraw(c.getContext("2d"), img, 0, 0, 48, 27);
    blurCache.set(img, c);
  }
  return c;
}

function sparkles(ctx: any, accent: string, t: number, count = 20, W = DW, H = DH) {
  ctx.save();
  ctx.fillStyle = accent;
  for (let k = 0; k < count; k++) {
    ctx.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(t * 0.8 + k));
    ctx.beginPath();
    ctx.arc((((k * 37) % 96) / 96) * W, (((k * 53) % 92) / 92) * H, 2.5 + (k % 3) * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function spaced(ctx: any, text: string, cx: number, y: number, spacing: number) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
  let x = cx - (widths.reduce((a, b) => a + b, 0) - spacing) / 2;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i];
  });
}

function wrapLines(ctx: any, words: string[], maxW: number): number[][] {
  const space = ctx.measureText(" ").width;
  const lines: number[][] = [];
  let line: number[] = [];
  let x = 0;
  words.forEach((w, i) => {
    const ww = ctx.measureText(w).width;
    if (x + ww > maxW && line.length) {
      lines.push(line);
      line = [];
      x = 0;
    }
    line.push(i);
    x += ww + space;
  });
  if (line.length) lines.push(line);
  return lines;
}

function rr(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBook(ctx: any, mk: MakeCanvas, img: any, job: Job, end: boolean, t: number) {
  const th = job.theme;
  const g = ctx.createRadialGradient(DW / 2, DH * 0.4, 50, DW / 2, DH * 0.4, DW * 0.75);
  g.addColorStop(0, th.from);
  g.addColorStop(1, th.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, DW, DH);
  if (img) {
    ctx.globalAlpha = 0.35;
    ctx.drawImage(blurred(mk, img), 0, 0, DW, DH);
    ctx.globalAlpha = 1;
  }
  sparkles(ctx, th.accent, t, 22);

  const bx = 390, by = 50, bw = 820, bh = 800;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.6)";
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 30;
  rr(ctx, bx, by, bw, bh, 26);
  const lg = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  lg.addColorStop(0, "#6b4328");
  lg.addColorStop(1, "#3f2614");
  ctx.fillStyle = lg;
  ctx.fill();
  ctx.restore();
  const sp = ctx.createLinearGradient(bx, 0, bx + 60, 0);
  sp.addColorStop(0, "rgba(0,0,0,.5)");
  sp.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sp;
  ctx.fillRect(bx, by, 60, bh);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  rr(ctx, bx + 34, by + 34, bw - 68, bh - 68, 14);
  ctx.stroke();

  const cx = bx + bw / 2;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = GOLD;
  ctx.font = `500 20px ${SANS}`;
  spaced(ctx, end ? "FIM  ·  COM MUITO AMOR" : `UM LIVRO DE AVENTURA PARA OS ${job.age} ANINHOS`, cx, by + 100, 6);
  if (img) {
    const s = 390, iy = by + 135;
    ctx.fillStyle = GOLD;
    ctx.fillRect(cx - s / 2 - 7, iy - 7, s + 14, s + 14);
    coverDraw(ctx, img, cx - s / 2, iy, s, s);
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#f3d58f";
  const title = end ? job.cartao.titulo : job.title;
  let size = 46;
  ctx.font = `700 ${size}px ${SANS}`;
  while (ctx.measureText(title).width > bw - 140 && size > 28) {
    size -= 3;
    ctx.font = `700 ${size}px ${SANS}`;
  }
  ctx.fillText(title, cx, by + 640);
  if (end) {
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = `500 24px ${SANS}`;
    ctx.fillText(job.cartao.subtitulo, cx, by + 695);
  }
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

function prettyDate(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${Number(m[3])} de ${MONTHS[Number(m[2]) - 1]} de ${m[1]}` : "";
}

/** Abertura animada: imagem de capa, chamada, título palavra por palavra, subtítulo e dedicatória. t = segundos desde o início. */
export function drawCover(ctx: any, mk: MakeCanvas, img: any, job: Job, t: number, W = DW, H = DH) {
  const th = job.theme;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
  const portrait = H > W;

  const g = ctx.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H * 0.4, Math.max(W, H) * 0.8);
  g.addColorStop(0, th.from);
  g.addColorStop(1, th.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (img) {
    ctx.globalAlpha = 0.5;
    ctx.drawImage(blurred(mk, img), 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.fillRect(0, 0, W, H);
    // imagem de capa: entra com fusão e um zoom suave que continua devagar
    const s = portrait ? W : H;
    const ix = (W - s) / 2;
    const iy = portrait ? (H - s) / 2 + 70 : 0;
    const k = 1.12 - 0.1 * ease(t / 2.6) + 0.012 * Math.min(t, 12);
    ctx.save();
    ctx.globalAlpha = ease(t / 1.2);
    ctx.beginPath();
    ctx.rect(ix, iy, s, s);
    ctx.clip();
    coverDraw(ctx, img, ix - (s * (k - 1)) / 2, iy - (s * (k - 1)) / 2, s * k, s * k);
    ctx.restore();
    ctx.globalAlpha = 1;
    // bordas da imagem se dissolvem no fundo desfocado
    for (const [x0, x1, a0, a1] of [[ix, ix + s * 0.12, 0.55, 0], [ix + s * 0.88, ix + s, 0, 0.55]] as const) {
      const eg = ctx.createLinearGradient(x0, 0, x1, 0);
      eg.addColorStop(0, `rgba(0,0,0,${a0})`);
      eg.addColorStop(1, `rgba(0,0,0,${a1})`);
      ctx.fillStyle = eg;
      ctx.fillRect(x0, iy, x1 - x0, s);
    }
  }
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.42);
  top.addColorStop(0, "rgba(0,0,0,.7)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.42);
  const bot = ctx.createLinearGradient(0, H * 0.6, 0, H);
  bot.addColorStop(0, "rgba(0,0,0,0)");
  bot.addColorStop(1, "rgba(0,0,0,.78)");
  ctx.fillStyle = bot;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);
  sparkles(ctx, th.accent, t, 22, W, H);

  // ondas animadas na base
  const wave = (y0: number, amp: number, wl: number, sp: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, y0 + amp * Math.sin((x / wl) * Math.PI * 2 + t * sp));
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  wave(H - 52, 9, 420, 1.3, "rgba(255,255,255,.14)");
  wave(H - 38, 8, 340, -1.7, th.accent + "66");
  wave(H - 22, 7, 300, 1.1, th.to + "ee");

  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,.7)";
  ctx.shadowBlur = 16;

  // chamada do topo
  ctx.globalAlpha = ease((t - 0.2) / 0.7);
  ctx.fillStyle = GOLD;
  ctx.font = `500 ${portrait ? 24 : 22}px ${SANS}`;
  const over = job.age === 1 ? "UM LIVRO DE AVENTURA PARA O 1 ANINHO" : `UM LIVRO DE AVENTURA PARA OS ${job.age} ANINHOS`;
  spaced(ctx, over, W / 2, portrait ? 190 : 70, 5);
  ctx.globalAlpha = 1;

  // título, palavra por palavra (o nome da criança em dourado)
  const words = job.title.split(/\s+/).filter(Boolean);
  const nameToks = (job.childName || "").split(/\s+/).map(norm).filter(Boolean);
  let size = portrait ? 76 : 84;
  const maxW = W - 150;
  ctx.font = `700 ${size}px ${SANS}`;
  const sp = () => ctx.measureText(" ").width;
  const total = () => words.reduce((a, w) => a + ctx.measureText(w).width, 0) + sp() * (words.length - 1);
  while (total() > maxW * (portrait ? 2 : 1) && size > 48) {
    size -= 4;
    ctx.font = `700 ${size}px ${SANS}`;
  }
  const lines = wrapLines(ctx, words, maxW);
  const lh = size * 1.12;
  let ty = (portrait ? 270 : 165) - ((lines.length - 1) * lh) / 2 + (lines.length > 1 ? 0 : 0);
  ctx.textAlign = "left";
  for (const line of lines) {
    const widths = line.map((i) => ctx.measureText(words[i]).width);
    let x = (W - (widths.reduce((a, b) => a + b, 0) + sp() * (line.length - 1))) / 2;
    line.forEach((i, n) => {
      const a = ease((t - (0.8 + 0.32 * i)) / 0.45);
      if (a > 0) {
        ctx.globalAlpha = a;
        ctx.fillStyle = nameToks.includes(norm(words[i])) ? "#ffd479" : "#fff";
        ctx.fillText(words[i], x, ty + (1 - a) * 30);
      }
      x += widths[n] + sp();
    });
    ty += lh;
  }
  ctx.globalAlpha = 1;

  // subtítulo e dedicatória
  const tEnd = 0.8 + 0.32 * words.length + 0.2;
  const sub = `${job.age} ${job.age === 1 ? "aninho" : "aninhos"}${job.birth ? ` · ${prettyDate(job.birth)}` : ""}`;
  ctx.textAlign = "center";
  ctx.globalAlpha = ease((t - tEnd) / 0.6);
  ctx.fillStyle = "#fff";
  ctx.font = `600 ${portrait ? 40 : 36}px ${SANS}`;
  ctx.fillText(sub, W / 2, H - (portrait ? 190 : 150) + (1 - ease((t - tEnd) / 0.6)) * 16);
  if (job.parents) {
    ctx.globalAlpha = ease((t - tEnd - 0.7) / 0.6);
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = `500 ${portrait ? 30 : 28}px ${SANS}`;
    ctx.fillText(`com todo o amor de ${job.parents}`, W / 2, H - (portrait ? 140 : 105) + (1 - ease((t - tEnd - 0.7) / 0.6)) * 16);
  }
  ctx.globalAlpha = 1;
  ctx.shadowColor = "transparent";
}

function drawImageFull(ctx: any, mk: MakeCanvas, gallery: any[], st: State) {
  const G = gallery.length;
  const layer = (img: any, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(blurred(mk, img), 0, 0, DW, DH);
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(0, 0, DW, DH);
    coverDraw(ctx, img, (DW - DH) / 2, 0, DH, DH);
    ctx.globalAlpha = 1;
  };
  if (st.mix < 1) layer(gallery[st.prev % G], 1);
  layer(gallery[st.cur % G], st.mix);
  const g = ctx.createLinearGradient(0, DH * 0.62, 0, DH);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,.72)");
  ctx.fillStyle = g;
  ctx.fillRect(0, DH * 0.62, DW, DH * 0.38);
}

function drawSub(ctx: any, st: State, accent: string) {
  if (!st.sub || !st.sub.length) return;
  ctx.font = `700 46px ${SANS}`;
  ctx.textBaseline = "alphabetic";
  const words = st.sub.map((x) => x.w);
  const lines = wrapLines(ctx, words, 1280);
  const space = ctx.measureText(" ").width;
  const lh = 66;
  let y = DH - 60 - (lines.length - 1) * lh;
  ctx.shadowColor = "rgba(0,0,0,.85)";
  ctx.shadowBlur = 14;
  ctx.textAlign = "left";
  for (const line of lines) {
    const widths = line.map((i) => ctx.measureText(words[i]).width);
    let x = (DW - (widths.reduce((a, b) => a + b, 0) + space * (line.length - 1))) / 2;
    line.forEach((i, n) => {
      if (st.sub![i].on) {
        ctx.fillStyle = st.sub![i].cur ? accent : "#fff";
        ctx.fillText(words[i], x, y);
      }
      x += widths[n] + space;
    });
    y += lh;
  }
  ctx.shadowColor = "transparent";
}

export function drawFrame(ctx: any, mk: MakeCanvas, imgs: any[], job: Job, tm: Timing, T: number) {
  const gallery = imgs.filter(Boolean);
  const st = stateAt(job, tm, T);
  if (!gallery.length) return drawBook(ctx, mk, undefined, job, st.phase === "end", T);
  if (st.phase === "cover") return drawCover(ctx, mk, gallery[0], job, T);
  if (st.phase === "end") return drawBook(ctx, mk, gallery[0], job, true, T);
  drawImageFull(ctx, mk, gallery, st);
  drawSub(ctx, st, "#ffe3a3");
}
