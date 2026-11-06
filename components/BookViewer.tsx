"use client";

import { ChevronLeft, ChevronRight, Download, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { wordWeight } from "@/lib/image";
import { getTheme } from "@/lib/themes";
import type { Answers, Photo, Result } from "@/lib/types";

const PAGE_H = 470;
const INK = "#3b2a1c";
const PAPER = "#fbf4e4";

// Livro interativo: capa de couro, páginas de papel que viram em 3D, texto acendendo no ritmo da narração,
// todas as imagens aparecendo ao longo da história e, no fim, a música tocando sozinha com as imagens em loop.
export function BookViewer({
  result,
  answers,
  onRestart,
}: {
  result: Result;
  answers: Answers;
  photos?: Photo[];
  onRestart: () => void;
}) {
  const { story, images } = result;
  const theme = getTheme(answers.themeId);
  const accent = theme.colors.accent;
  const hi = theme.colors.from;
  const pages = story.paginas;
  const n = pages.length;

  const gallery = useMemo(() => images.filter((x): x is string => Boolean(x)), [images]);

  // Distribui TODAS as imagens pelas páginas de texto (ex.: 10 imagens em 4 páginas = 2, 3, 2 e 3).
  const chunks = useMemo(
    () =>
      pages.map((_, i) => {
        if (!gallery.length) return [] as string[];
        const G = gallery.length;
        const s = Math.floor((i * G) / n);
        const e = Math.max(Math.floor(((i + 1) * G) / n), s + 1);
        return gallery.slice(s, Math.min(e, G));
      }),
    [pages, gallery, n],
  );

  const [view, setView] = useState(-1); // -1 capa · 0..n-1 páginas · n final (música)
  const [local, setLocal] = useState(0); // progresso da narração dentro da página (0..1)
  const [leaf, setLeaf] = useState<{ v: number } | null>(null);
  const [narrPlaying, setNarrPlaying] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicEnded, setMusicEnded] = useState(false);
  const [musicT, setMusicT] = useState(0);
  const [musicFrac, setMusicFrac] = useState(0);
  const [narrNow, setNarrNow] = useState(0); // segundo atual da narração
  const times = result.narrTimes && result.narrTimes.length === n ? result.narrTimes : null;

  const viewRef = useRef(-1);
  const leafTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const narr = useRef<HTMLAudioElement>(null);
  const music = useRef<HTMLAudioElement>(null);

  const weights = useMemo(() => pages.map((p) => p.texto.split(" ").reduce((s, w) => s + wordWeight(w), 0)), [pages]);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const starts = useMemo(() => {
    let acc = 0;
    return weights.map((w) => {
      const s = acc / total;
      acc += w;
      return s;
    });
  }, [weights, total]);

  const jsonUrl = useMemo(
    () => URL.createObjectURL(new Blob([JSON.stringify(story, null, 2)], { type: "application/json" })),
    [story],
  );

  /* ---------- troca de página (vira em 3D quando avança) ---------- */
  const changeView = (next: number) => {
    const cur = viewRef.current;
    if (next === cur) return;
    if (next > cur) {
      setLeaf({ v: cur });
      if (leafTimer.current) clearTimeout(leafTimer.current);
      leafTimer.current = setTimeout(() => setLeaf(null), 950);
    } else {
      setLeaf(null);
    }
    viewRef.current = next;
    setView(next);
  };

  /* ---------- narração ---------- */
  const onNarrTime = () => {
    const el = narr.current;
    if (!el || !el.duration) return;
    if (times) {
      const t = el.currentTime;
      setNarrNow(t);
      let i = 0;
      for (let k = 0; k < n; k++) if (t >= times[k].start - 0.05) i = k;
      const end = i + 1 < n ? times[i + 1].start : el.duration;
      changeView(i);
      setLocal(Math.min(1, Math.max(0, (t - times[i].start) / (end - times[i].start || 1))));
      return;
    }
    const frac = el.currentTime / el.duration;
    let i = 0;
    for (let k = 0; k < n; k++) if (frac >= starts[k]) i = k;
    const end = i + 1 < n ? starts[i + 1] : 1;
    changeView(i);
    setLocal(Math.min(1, Math.max(0, (frac - starts[i]) / (end - starts[i] || 1))));
  };

  // Destrava a música durante o toque do usuário, para ela poder tocar sozinha no fim da história.
  const primeMusic = () => {
    const m = music.current;
    if (!m) return;
    m.muted = true;
    m.play()
      .then(() => {
        m.pause();
        m.currentTime = 0;
        m.muted = false;
      })
      .catch(() => {
        m.muted = false;
      });
  };

  const startStory = () => {
    const el = narr.current;
    if (!el) {
      changeView(Math.max(0, viewRef.current));
      return;
    }
    primeMusic();
    if (viewRef.current < 0 || viewRef.current >= n) {
      el.currentTime = 0;
      setLocal(0);
      changeView(0);
    }
    el.play().catch(() => {});
  };

  // Tenta começar sozinho; se o navegador bloquear, o botão "Ouvir a história" continua disponível.
  useEffect(() => {
    const t = setTimeout(() => {
      if (viewRef.current === -1 && narr.current) startStory();
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ao chegar no final, a música começa sozinha; ao sair, pausa.
  useEffect(() => {
    const m = music.current;
    if (!m) return;
    if (view === n) {
      m.currentTime = 0;
      m.play().catch(() => {});
    } else {
      m.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const goto = (v: number) => {
    const target = Math.max(-1, Math.min(n, v));
    narr.current?.pause();
    if (narr.current?.duration && target >= 0 && target < n)
      narr.current.currentTime = times ? times[target].start : starts[target] * narr.current.duration;
    if (target === -1 && narr.current) narr.current.currentTime = 0;
    setLocal(target >= 0 && target < n ? 0 : 1);
    changeView(target);
  };

  const restart = () => {
    music.current?.pause();
    setMusicEnded(false);
    goto(-1);
    setTimeout(startStory, 900);
  };

  const toggle = () => {
    if (view === n) {
      const m = music.current;
      if (!m) return;
      if (musicEnded) return restart();
      if (m.paused) m.play().catch(() => {});
      else m.pause();
      return;
    }
    const el = narr.current;
    if (!el) return changeView(view + 1);
    if (!el.paused) el.pause();
    else startStory();
  };

  const mainLabel =
    view === n
      ? musicEnded
        ? "Ver de novo"
        : musicPlaying
          ? "Pausar"
          : "Tocar música"
      : narrPlaying
        ? "Pausar"
        : view < 0
          ? result.narrationUrl
            ? "Ouvir a história"
            : "Abrir o livro"
          : "Continuar";
  const mainPlaying = view === n ? musicPlaying && !musicEnded : narrPlaying;

  /* ---------- peças visuais ---------- */
  const sparks = (count = 14, color = accent) =>
    Array.from({ length: count }).map((_, k) => (
      <span
        key={k}
        className="twinkle pointer-events-none absolute rounded-full"
        style={{
          left: `${(k * 37) % 96}%`,
          top: `${(k * 53) % 92}%`,
          width: 3 + (k % 3) * 2,
          height: 3 + (k % 3) * 2,
          background: color,
          animationDelay: `${(k % 5) * 0.6}s`,
        }}
      />
    ));

  const polaroid = (imgs: string[], active: number, rotate: number, size: number) => (
    <div className="relative mx-auto" style={{ width: size, transform: `rotate(${rotate}deg)` }}>
      <div
        className="absolute left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-sm"
        style={{ top: -9, background: `${accent}cc`, transform: "rotate(-3deg)", boxShadow: "0 2px 5px rgba(0,0,0,.2)" }}
      />
      <div className="rounded-md bg-white p-2" style={{ boxShadow: "0 14px 30px rgba(60,30,10,.35)" }}>
        <div className="relative overflow-hidden rounded-[3px]" style={{ width: size - 16, height: size - 16 }}>
          {imgs.length ? (
            imgs.map((src, k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={k}
                src={src}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${k === active ? "kenburns opacity-100" : "opacity-0"}`}
                style={{ objectPosition: "50% 30%" }}
              />
            ))
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-black/10 text-xs text-black/50">imagem indisponível</div>
          )}
          {imgs.length > 1 ? (
            <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
              {imgs.map((_, k) => (
                <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ background: k === active ? "#fff" : "rgba(255,255,255,.5)" }} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  const paperPage = (children: ReactNode) => (
    <div className="absolute inset-0 overflow-hidden" style={{ background: PAPER, color: INK }}>
      {children}
      <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to right, rgba(60,30,10,.28), rgba(60,30,10,0) 9%)" }} />
    </div>
  );

  const renderText = (i: number, loc: number) => {
    const words = pages[i].texto.split(" ");
    if (times && times[i].words.length === words.filter(Boolean).length) {
      const tw = times[i].words;
      return words.map((w, k) => {
        const on = loc >= 1 || narrNow >= tw[k].s - 0.02;
        const current = loc < 1 && on && narrNow <= tw[k].e + 0.12;
        return (
          <span
            key={k}
            className="inline-block transition-all duration-200"
            style={{ opacity: on ? 1 : 0.28, color: current ? hi : INK, fontWeight: current ? 600 : 500, marginRight: "0.28em" }}
          >
            {w}
          </span>
        );
      });
    }
    const lit = loc * weights[i];
    let acc = 0;
    return words.map((w, k) => {
      const before = acc;
      acc += wordWeight(w);
      const on = before <= lit;
      const current = on && lit - before < 7 && loc < 1;
      return (
        <span
          key={k}
          className="inline-block transition-all duration-300"
          style={{ opacity: on ? 1 : 0.28, color: current ? hi : INK, fontWeight: current ? 600 : 500, marginRight: "0.28em" }}
        >
          {w}
        </span>
      );
    });
  };

  const pageCover = () => (
    <div className="absolute inset-0 overflow-hidden text-white" style={{ background: `linear-gradient(160deg, ${theme.colors.from}, ${theme.colors.to})` }}>
      {sparks()}
      <div className="relative flex h-full flex-col items-center justify-center px-5 text-center">
        {polaroid(gallery.slice(0, 1), 0, -2, 250)}
        <p className="mt-6 text-[11px] uppercase tracking-[0.3em]" style={{ color: accent }}>um livro de aventura</p>
        <h2 className="mt-1 text-[26px] font-semibold leading-tight">{story.titulo}</h2>
        <p className="mt-1 text-sm text-white/70">{answers.age} aninhos · com carinho de {answers.parents}</p>
      </div>
    </div>
  );

  const pageText = (i: number, loc: number) => {
    const ch = chunks[i] ?? [];
    const idx = ch.length ? Math.min(ch.length - 1, Math.floor(loc * ch.length)) : 0;
    return paperPage(
      <div className="relative flex h-full flex-col px-5 pb-3 pt-5">
        {polaroid(ch, idx, i % 2 ? 1.6 : -1.6, 214)}
        <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color: hi }}>{pages[i].capitulo}</p>
        <p className="mt-2 text-[15px] leading-[1.5]">{renderText(i, loc)}</p>
        <p className="mt-auto pt-1 text-center text-xs" style={{ opacity: 0.5 }}>— {i + 1} —</p>
      </div>,
    );
  };

  const ls = result.lyricStarts && result.lyricStarts.length === story.letra.length ? result.lyricStarts : null;
  let lyricIdx = Math.min(story.letra.length - 1, Math.floor(musicFrac * story.letra.length));
  if (ls) {
    lyricIdx = 0;
    for (let k = 0; k < ls.length; k++) if (musicT >= ls[k] - 0.1) lyricIdx = k;
  }
  const slideIdx = gallery.length ? Math.floor(musicT / 4) % gallery.length : 0;
  const showEnd = musicEnded || musicFrac > 0.92;

  const pageFinale = () => (
    <div className="absolute inset-0 overflow-hidden text-white" style={{ background: `linear-gradient(160deg, ${theme.colors.from}, ${theme.colors.to})` }}>
      {gallery.length ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`bg-${slideIdx}`} src={gallery[slideIdx]} alt="" className="fade-in absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-2xl" />
      ) : null}
      {sparks(18)}
      <div className="relative flex h-full flex-col items-center px-5 pt-6 text-center">
        <div className="relative rounded-md bg-white p-2" style={{ boxShadow: "0 18px 40px rgba(0,0,0,.45)", width: 236 }}>
          <div className="relative overflow-hidden rounded-[3px]" style={{ width: 220, height: 220 }}>
            {gallery.length ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`fg-${slideIdx}`} src={gallery[slideIdx]} alt="" className="fade-in kenburns absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "50% 30%" }} />
            ) : null}
          </div>
        </div>
        <div className="mt-5 min-h-[92px] px-1">
          {showEnd ? (
            <>
              <p className="text-[22px] font-semibold leading-tight" style={{ color: accent }}>{story.cartao_final.titulo}</p>
              <p className="mt-1 text-sm text-white/80">{story.cartao_final.subtitulo}</p>
            </>
          ) : result.musicUrl ? (
            <>
              <p className="text-xs text-white/50">{story.letra[Math.max(0, lyricIdx - 1)]}</p>
              <p key={lyricIdx} className="fade-in mt-1 text-[21px] font-semibold leading-snug">{story.letra[lyricIdx]}</p>
            </>
          ) : (
            <p className="text-sm text-white/70">A música não pôde ser gerada desta vez.</p>
          )}
        </div>
      </div>
    </div>
  );

  const pageFor = (v: number, forLeaf = false) => {
    if (v < 0) return pageCover();
    if (v >= n) return pageFinale();
    return pageText(v, forLeaf || v !== view ? 1 : local);
  };

  return (
    <div className="pb-4">
      {/* livro */}
      <div className="relative" style={{ height: PAGE_H }}>
        <div className="absolute inset-0 rounded-[22px]" style={{ background: "linear-gradient(135deg,#7a4a30,#4b2a1a)", boxShadow: "0 24px 50px rgba(0,0,0,.45)" }} />
        <div
          className="absolute overflow-hidden rounded-[12px]"
          style={{ inset: "10px 10px 10px 16px", perspective: 1400, boxShadow: "4px 0 0 #efe3c8, 8px 0 0 #e2d4b6" }}
        >
          <div key={view} className={`absolute inset-0 ${leaf ? "" : "page-in"}`}>
            {pageFor(view)}
          </div>
          {leaf ? (
            <div className="leaf absolute inset-0">
              {pageFor(leaf.v, true)}
              <div className="leaf-shade absolute inset-0" />
            </div>
          ) : null}
        </div>
      </div>

      {/* controles */}
      <div className="mt-4 flex items-center justify-between">
        <button type="button" aria-label="Página anterior" onClick={() => goto(view - 1)} className="liquid-glass flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronLeft size={18} className="relative z-10" />
        </button>
        <button type="button" onClick={toggle} className="liquid-glass-selected flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium">
          {view === n && musicEnded ? <RotateCcw size={16} className="relative z-10" /> : mainPlaying ? <Pause size={16} className="relative z-10" /> : <Play size={16} className="relative z-10" />}
          <span className="relative z-10">{mainLabel}</span>
        </button>
        <button type="button" aria-label="Próxima página" onClick={() => goto(view + 1)} className="liquid-glass flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronRight size={18} className="relative z-10" />
        </button>
      </div>

      {result.narrationUrl ? (
        <audio
          ref={narr}
          src={result.narrationUrl}
          onTimeUpdate={onNarrTime}
          onPlay={() => setNarrPlaying(true)}
          onPause={() => setNarrPlaying(false)}
          onEnded={() => {
            setNarrPlaying(false);
            setLocal(1);
            changeView(n);
          }}
        />
      ) : null}
      {result.musicUrl ? (
        <audio
          ref={music}
          src={result.musicUrl}
          onPlay={() => {
            setMusicPlaying(true);
            setMusicEnded(false);
          }}
          onPause={() => setMusicPlaying(false)}
          onEnded={() => {
            setMusicPlaying(false);
            setMusicEnded(true);
          }}
          onTimeUpdate={() => {
            const el = music.current;
            if (!el) return;
            setMusicT(el.currentTime);
            if (el.duration) setMusicFrac(el.currentTime / el.duration);
          }}
        />
      ) : null}

      {/* downloads */}
      <div className="liquid-glass mt-5 rounded-[28px] p-4">
        <p className="relative z-10 mb-3 text-sm font-medium">Seus arquivos</p>
        <div className="relative z-10 grid grid-cols-2 gap-2 text-xs">
          {images.map((img, i) =>
            img ? (
              <a key={i} href={img} download={`imagem-${i + 1}.webp`} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2">
                <Download size={12} /> Imagem {i + 1}
              </a>
            ) : null,
          )}
          {result.narrationUrl ? (
            <a href={result.narrationUrl} download="narracao.mp3" className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2">
              <Download size={12} /> Narração
            </a>
          ) : null}
          {result.musicUrl ? (
            <a href={result.musicUrl} download="musica.mp3" className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2">
              <Download size={12} /> Música
            </a>
          ) : null}
          <a href={jsonUrl} download="historia.json" className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2">
            <Download size={12} /> Roteiro (JSON)
          </a>
        </div>
        {result.errors.length ? (
          <p className="relative z-10 mt-3 text-[11px] leading-snug text-white/60">Alguns itens falharam: {result.errors.join(" · ")}</p>
        ) : null}
        <p className="relative z-10 mt-3 text-[11px] text-white/50">Os arquivos ficam só neste navegador. Baixe antes de fechar a página.</p>
      </div>

      <button type="button" onClick={onRestart} className="liquid-glass mx-auto mt-4 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm text-white/80">
        <RotateCcw size={14} className="relative z-10" />
        <span className="relative z-10">Criar outro livro</span>
      </button>
    </div>
  );
}
