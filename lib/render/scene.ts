/* eslint-disable @typescript-eslint/no-explicit-any */
// Desenho do livro-vídeo em canvas 2D. Roda igual no navegador (testes) e no servidor (@napi-rs/canvas).
// Coordenadas de projeto: 1600x900. O chamador escala para a resolução final.

export const DW = 1600;
export const DH = 900;
export const COVER_SEC = 3;
export const GAP_SEC = 1;
export const TAIL_SEC = 4;
export const FPS = 15;

export type Job = {
  title: string;
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

const SERIF = "Lora, Georgia, serif";
const SANS = "Poppins, Helvetica, Arial, sans-serif";
const INK = "#3b2a1c";
const PAPER = "#fbf4e4";
const RED = "#c0453a";

export function layout(job: Job, tm: Timing) {
  const narrAt = COVER_SEC;
  const finaleAt = narrAt + tm.narrDur + GAP_SEC;
  const total = finaleAt + tm.musicDur + TAIL_SEC;
  return { narrAt, finaleAt, total };
}

/** Instantes em que a imagem muda (palavra acende, página vira, verso troca, slide troca...). */
export function eventTimes(job: Job, tm: Timing): number[] {
  const { narrAt, finaleAt, total } = layout(job, tm);
  const set = new Set<number>();
  const add = (t: number) => {
    if (t >= 0 && t < total) set.add(Math.round(t * FPS) / FPS);
  };
  add(0);
  add(narrAt);
  job.pages.forEach((p, i) => {
    add(narrAt + p.start);
    const end = i + 1 < job.pages.length ? job.pages[i + 1].start : tm.narrDur;
    p.words?.forEach((w) => {
      add(narrAt + w.s);
      add(narrAt + w.e + 0.12);
    });
    const k = p.imgs.length;
    for (let j = 1; j < k; j++) add(narrAt + p.start + ((end - p.start) * j) / k);
  });
  add(finaleAt);
  for (let t = 4; t < tm.musicDur; t += 4) add(finaleAt + t);
  const L = job.letra.length;
  for (let k = 0; k < L; k++) add(finaleAt + (job.lyricStarts ? job.lyricStarts[k] : (tm.musicDur * k) / L));
  add(finaleAt + tm.musicDur * 0.93);
  return [...set].sort((a, b) => a - b);
}

/* ---------- utilidades de desenho ---------- */
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
    c = mk(40, 23);
    const g = c.getContext("2d");
    coverDraw(g, img, 0, 0, 40, 23);
    blurCache.set(img, c);
  }
  return c;
}

function sparkles(ctx: any, accent: string, t: number, count = 20) {
  ctx.save();
  ctx.fillStyle = accent;
  for (let k = 0; k < count; k++) {
    const x = ((k * 37) % 96) / 96 * DW;
    const y = ((k * 53) % 92) / 92 * DH;
    const r = 2.5 + (k % 3) * 1.6;
    ctx.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(t * 0.8 + k));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function spaced(ctx: any, text: string, cx: number, y: number, spacing: number) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let x = cx - total / 2;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i];
  });
}

function polaroid(ctx: any, img: any, cx: number, cy: number, w: number, rotDeg: number, accent: string) {
  const pad = w * 0.045;
  const side = w - pad * 2;
  const h = side + pad + w * 0.13;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,.4)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = "#fff";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = "transparent";
  coverDraw(ctx, img, -w / 2 + pad, -h / 2 + pad, side, side);
  ctx.save();
  ctx.translate(0, -h / 2);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = accent;
  ctx.fillRect(-64, -18, 128, 36);
  ctx.restore();
  ctx.restore();
}

function wrap(ctx: any, words: string[], maxW: number) {
  const space = ctx.measureText(" ").width;
  const lines: { word: string; idx: number; x: number }[][] = [];
  let line: { word: string; idx: number; x: number }[] = [];
  let x = 0;
  words.forEach((w, idx) => {
    const ww = ctx.measureText(w).width;
    if (x + ww > maxW && line.length) {
      lines.push(line);
      line = [];
      x = 0;
    }
    line.push({ word: w, idx, x });
    x += ww + space;
  });
  if (line.length) lines.push(line);
  return lines;
}

/* ---------- quadro ---------- */
export function drawFrame(ctx: any, mk: MakeCanvas, imgs: any[], job: Job, tm: Timing, t: number) {
  const { narrAt, finaleAt } = layout(job, tm);
  const th = job.theme;
  const gallery = imgs.filter(Boolean);
  const sparkT = t;

  if (t < narrAt || gallery.length === 0) return drawCover(ctx, mk, gallery, job, sparkT);
  if (t < finaleAt) return drawPage(ctx, gallery, job, tm, t - narrAt, sparkT);
  return drawFinale(ctx, gallery, job, tm, t - finaleAt, sparkT);
}

function drawCover(ctx: any, mk: MakeCanvas, gallery: any[], job: Job, t: number) {
  const th = job.theme;
  const g = ctx.createRadialGradient(DW / 2, DH * 0.4, 50, DW / 2, DH * 0.4, DW * 0.75);
  g.addColorStop(0, th.from);
  g.addColorStop(1, th.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, DW, DH);
  if (gallery[0]) {
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(blurred(mk, gallery[0]), 0, 0, DW, DH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, DW, DH);
  }
  sparkles(ctx, th.accent, t, 22);
  ctx.textAlign = "center";
  ctx.fillStyle = th.accent;
  ctx.font = `500 22px ${SANS}`;
  ctx.textBaseline = "alphabetic";
  spaced(ctx, `UM LIVRO DE AVENTURA PARA OS ${job.age} ANINHOS`, DW / 2, 96, 7);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = `700 78px ${SANS}`;
  const title = fitText(ctx, job.title, DW - 200, 78, 700);
  ctx.fillText(title.text, DW / 2, 190);
  if (gallery[0]) polaroid(ctx, gallery[0], DW / 2, 560, 400, -2, th.accent);
}

function fitText(ctx: any, text: string, maxW: number, size: number, weight: number) {
  let s = size;
  ctx.font = `${weight} ${s}px ${SANS}`;
  while (ctx.measureText(text).width > maxW && s > 36) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${SANS}`;
  }
  return { text, size: s };
}

function drawPage(ctx: any, gallery: any[], job: Job, tm: Timing, tn: number, sparkT: number) {
  const th = job.theme;
  const pages = job.pages;
  let i = 0;
  for (let k = 0; k < pages.length; k++) if (tn >= pages[k].start - 0.05) i = k;
  const p = pages[i];
  const end = i + 1 < pages.length ? pages[i + 1].start : tm.narrDur;
  const local = Math.min(1, Math.max(0, (tn - p.start) / (end - p.start || 1)));

  const g = ctx.createLinearGradient(0, 0, DW, DH);
  g.addColorStop(0, th.to);
  g.addColorStop(1, "#1a1208");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, DW, DH);
  sparkles(ctx, th.accent, sparkT, 12);

  // livro aberto
  const bx = 60, by = 50, bw = 1480, bh = 800;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  rr(ctx, bx, by, bw, bh, 28);
  ctx.fillStyle = "#6b4328";
  ctx.fill();
  ctx.restore();
  rr(ctx, bx + 14, by + 14, bw - 28, bh - 28, 16);
  ctx.fillStyle = PAPER;
  ctx.fill();
  const mid = bx + bw / 2;
  const lg = ctx.createLinearGradient(mid - 40, 0, mid + 40, 0);
  lg.addColorStop(0, "rgba(0,0,0,0)");
  lg.addColorStop(0.5, "rgba(60,30,10,.18)");
  lg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = lg;
  ctx.fillRect(mid - 40, by + 14, 80, bh - 28);

  const imgsIdx = p.imgs.length ? p.imgs : [0];
  const active = Math.min(imgsIdx.length - 1, Math.floor(local * imgsIdx.length));
  const img = gallery[imgsIdx[active] % gallery.length];
  const imgOnLeft = i % 2 === 0;
  const imgCx = imgOnLeft ? bx + bw * 0.25 : bx + bw * 0.75;
  const txtX = imgOnLeft ? mid + 70 : bx + 70;
  const txtW = bw / 2 - 140;
  polaroid(ctx, img, imgCx, by + bh / 2, 500, imgOnLeft ? -2 : 2, th.accent);

  // texto
  ctx.textBaseline = "alphabetic";
  ctx.font = `400 40px ${SERIF}`;
  const words = p.texto.split(/\s+/).filter(Boolean);
  const lines = wrap(ctx, words, txtW);
  const lh = 62;
  const blockH = lines.length * lh + 110;
  let y = by + bh / 2 - blockH / 2 + 30;
  ctx.fillStyle = RED;
  ctx.font = `500 21px ${SANS}`;
  spaced(ctx, p.capitulo.toUpperCase(), txtX + txtW / 2, y, 5);
  ctx.fillStyle = "rgba(192,69,58,.4)";
  ctx.fillRect(txtX + txtW / 2 - 70, y + 18, 140, 2);
  y += 80;
  ctx.font = `400 40px ${SERIF}`;
  ctx.textAlign = "left";
  const tw = p.words && p.words.length === words.length ? p.words : null;
  for (const line of lines) {
    for (const w of line) {
      let on: boolean, cur = false;
      if (tw) {
        on = tn >= tw[w.idx].s - 0.02;
        cur = on && tn <= tw[w.idx].e + 0.12;
      } else {
        on = local >= w.idx / words.length;
        cur = on && local < (w.idx + 1) / words.length;
      }
      ctx.globalAlpha = on ? 1 : 0.25;
      ctx.fillStyle = cur ? th.from : INK;
      ctx.fillText(w.word, txtX + w.x, y);
    }
    y += lh;
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(59,42,28,.5)";
  ctx.font = `400 20px ${SERIF}`;
  ctx.textAlign = "center";
  ctx.fillText(`— ${i + 1} —`, txtX + txtW / 2, by + bh - 50);
}

function drawFinale(ctx: any, gallery: any[], job: Job, tm: Timing, tm_: number, sparkT: number) {
  const th = job.theme;
  const g = ctx.createRadialGradient(DW / 2, DH * 0.35, 50, DW / 2, DH * 0.35, DW * 0.8);
  g.addColorStop(0, th.from);
  g.addColorStop(1, th.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, DW, DH);
  sparkles(ctx, th.accent, sparkT, 24);
  const G = gallery.length;
  const slide = Math.floor(tm_ / 4) % G;
  const spots: [number, number, number][] = [[240, 190, -7], [1360, 200, 6], [330, 500, 5], [1270, 490, -6]];
  ctx.globalAlpha = 0.92;
  spots.forEach(([x, y, r], o) => polaroid(ctx, gallery[(slide + o + 1) % G], x, y, 270, r, th.accent));
  ctx.globalAlpha = 1;
  polaroid(ctx, gallery[slide], DW / 2, 320, 460, 0, th.accent);

  const L = job.letra.length;
  let li = Math.min(L - 1, Math.floor((tm_ / tm.musicDur) * L));
  if (job.lyricStarts && job.lyricStarts.length === L) {
    li = 0;
    for (let k = 0; k < L; k++) if (tm_ >= job.lyricStarts[k] - 0.1) li = k;
  }
  const showEnd = tm_ / tm.musicDur > 0.93;
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0,0,0,.6)";
  ctx.shadowBlur = 14;
  if (showEnd) {
    ctx.fillStyle = "#ffe3a3";
    ctx.font = `700 56px ${SANS}`;
    ctx.fillText(job.cartao.titulo, DW / 2, 790);
    ctx.fillStyle = "#fff";
    ctx.font = `500 26px ${SANS}`;
    ctx.fillText(job.cartao.subtitulo, DW / 2, 836);
  } else {
    ctx.globalAlpha = 0.55;
    ctx.font = `500 24px ${SANS}`;
    ctx.fillText(job.letra[Math.max(0, li - 1)] || "", DW / 2, 770);
    ctx.globalAlpha = 1;
    ctx.font = `700 44px ${SANS}`;
    ctx.fillText(job.letra[li] || "", DW / 2, 830);
  }
  ctx.shadowColor = "transparent";
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
