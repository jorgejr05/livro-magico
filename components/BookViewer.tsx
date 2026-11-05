"use client";

import { ChevronLeft, ChevronRight, Download, Pause, Play, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { wordWeight } from "@/lib/image";
import { getTheme } from "@/lib/themes";
import type { Answers, Photo, Result } from "@/lib/types";

// Leitor interativo do livro: capa, páginas com texto acendendo no ritmo da narração e música com letra.
// (A versão em vídeo MP4 virá do Remotion numa próxima etapa.)
export function BookViewer({
  result,
  answers,
  onRestart,
}: {
  result: Result;
  answers: Answers;
  photos: Photo[];
  onRestart: () => void;
}) {
  const { story, images } = result;
  const theme = getTheme(answers.themeId);
  const pages = story.paginas;
  const n = pages.length;

  const [view, setView] = useState(-1); // -1 capa · 0..n-1 páginas · n final com música
  const [local, setLocal] = useState(0); // progresso da narração dentro da página (0..1)
  const [playing, setPlaying] = useState(false);
  const [musicFrac, setMusicFrac] = useState(0);
  const narr = useRef<HTMLAudioElement>(null);
  const music = useRef<HTMLAudioElement>(null);

  const weights = useMemo(
    () => pages.map((p) => p.texto.split(" ").reduce((s, w) => s + wordWeight(w), 0)),
    [pages],
  );
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const starts = useMemo(() => {
    let acc = 0;
    return weights.map((w) => {
      const s = acc / total;
      acc += w;
      return s;
    });
  }, [weights, total]);

  const imageFor = (i: number) => images[pages[i]?.foto ?? 0] ?? images.find(Boolean) ?? null;
  const cover = images.find(Boolean) ?? null;

  const jsonUrl = useMemo(
    () => URL.createObjectURL(new Blob([JSON.stringify(story, null, 2)], { type: "application/json" })),
    [story],
  );

  const onNarrTime = () => {
    const el = narr.current;
    if (!el || !el.duration) return;
    const frac = el.currentTime / el.duration;
    let i = 0;
    for (let k = 0; k < n; k++) if (frac >= starts[k]) i = k;
    const end = i + 1 < n ? starts[i + 1] : 1;
    setView(i);
    setLocal(Math.min(1, Math.max(0, (frac - starts[i]) / (end - starts[i] || 1))));
  };

  const playNarration = () => {
    const el = narr.current;
    music.current?.pause();
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    if (view < 0 || view >= n) el.currentTime = 0;
    el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const goto = (v: number) => {
    narr.current?.pause();
    setPlaying(false);
    setLocal(1);
    setView(Math.max(-1, Math.min(n, v)));
  };

  const accent = theme.colors.accent;

  /* ---------- palavras acendendo ---------- */
  const renderText = (i: number) => {
    const words = pages[i].texto.split(" ");
    const lit = local * weights[i];
    let acc = 0;
    return words.map((w, k) => {
      const on = playing || narr.current?.currentTime ? acc <= lit : true;
      acc += wordWeight(w);
      return (
        <span key={k} className="inline-block transition-all duration-300" style={{ opacity: on ? 1 : 0.25, color: on && playing && acc > lit - 6 ? accent : undefined, marginRight: "0.28em" }}>
          {w}
        </span>
      );
    });
  };

  const lyricIdx = Math.min(story.letra.length - 1, Math.floor(musicFrac * story.letra.length));

  return (
    <div className="pb-4">
      <div
        key={view}
        className="page-in relative overflow-hidden rounded-[32px]"
        style={{ background: `linear-gradient(160deg, ${theme.colors.from}, ${theme.colors.to})`, minHeight: 470 }}
      >
        {/* faíscas */}
        {Array.from({ length: 14 }).map((_, k) => (
          <span
            key={k}
            className="twinkle pointer-events-none absolute rounded-full"
            style={{
              left: `${(k * 37) % 96}%`,
              top: `${(k * 53) % 92}%`,
              width: 3 + (k % 3) * 2,
              height: 3 + (k % 3) * 2,
              background: accent,
              animationDelay: `${(k % 5) * 0.6}s`,
            }}
          />
        ))}

        {view === -1 ? (
          <div className="relative flex flex-col items-center p-5 text-center">
            <Frame src={cover} accent={accent} h={290} />
            <p className="mt-4 text-[11px] uppercase tracking-[0.3em]" style={{ color: accent }}>um livro de aventura</p>
            <h2 className="mt-1 text-[26px] font-semibold leading-tight">{story.titulo}</h2>
            <p className="mt-1 text-sm text-white/70">{answers.age} aninhos · com carinho de {answers.parents}</p>
          </div>
        ) : null}

        {view >= 0 && view < n ? (
          <div className="relative flex flex-col p-5">
            <Frame src={imageFor(view)} accent={accent} h={230} caption={pages[view].legenda} />
            <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color: accent }}>{pages[view].capitulo}</p>
            <p className="mt-2 text-[17px] leading-[1.55]">{renderText(view)}</p>
            <p className="mt-3 text-center text-xs text-white/50">— {view + 1} —</p>
          </div>
        ) : null}

        {view === n ? (
          <div className="relative flex flex-col items-center p-5 text-center">
            <Frame src={cover} accent={accent} h={220} />
            <div className="mt-4 min-h-[88px]">
              {result.musicUrl ? (
                <>
                  <p className="text-xs text-white/50">{story.letra[Math.max(0, lyricIdx - 1)]}</p>
                  <p className="mt-1 text-[20px] font-semibold leading-snug">{story.letra[lyricIdx]}</p>
                </>
              ) : (
                <p className="text-sm text-white/70">A música não pôde ser gerada desta vez.</p>
              )}
            </div>
            <p className="mt-2 text-lg font-semibold" style={{ color: accent }}>{story.cartao_final.titulo}</p>
            <p className="text-xs text-white/70">{story.cartao_final.subtitulo}</p>
          </div>
        ) : null}
      </div>

      {/* controles */}
      <div className="mt-4 flex items-center justify-between">
        <button type="button" aria-label="Página anterior" onClick={() => goto(view - 1)} className="liquid-glass flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronLeft size={18} className="relative z-10" />
        </button>
        {view < n ? (
          <button
            type="button"
            onClick={playNarration}
            disabled={!result.narrationUrl}
            className="liquid-glass-selected flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium disabled:opacity-40"
          >
            {playing ? <Pause size={16} className="relative z-10" /> : <Play size={16} className="relative z-10" />}
            <span className="relative z-10">{playing ? "Pausar" : view < 0 ? "Ouvir a história" : "Continuar"}</span>
          </button>
        ) : (
          <span className="text-xs text-white/60">Toque no player para ouvir a música</span>
        )}
        <button type="button" aria-label="Próxima página" onClick={() => goto(view + 1)} className="liquid-glass flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronRight size={18} className="relative z-10" />
        </button>
      </div>

      {result.narrationUrl ? (
        <audio
          ref={narr}
          src={result.narrationUrl}
          onTimeUpdate={onNarrTime}
          onEnded={() => {
            setPlaying(false);
            setView(n);
            music.current?.play().catch(() => {});
          }}
        />
      ) : null}

      {view === n && result.musicUrl ? (
        <audio
          ref={music}
          className="mt-3 w-full"
          controls
          src={result.musicUrl}
          onTimeUpdate={() => {
            const el = music.current;
            if (el?.duration) setMusicFrac(el.currentTime / el.duration);
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
          <p className="relative z-10 mt-3 text-[11px] leading-snug text-white/60">
            Alguns itens falharam: {result.errors.join(" · ")}
          </p>
        ) : null}
        <p className="relative z-10 mt-3 text-[11px] text-white/50">
          Os arquivos ficam só neste navegador. Baixe antes de fechar a página.
        </p>
      </div>

      <button type="button" onClick={onRestart} className="liquid-glass mx-auto mt-4 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm text-white/80">
        <RotateCcw size={14} className="relative z-10" />
        <span className="relative z-10">Criar outro livro</span>
      </button>
    </div>
  );
}

function Frame({ src, accent, h, caption }: { src: string | null; accent: string; h: number; caption?: string }) {
  return (
    <div className="w-full rounded-[22px] bg-white p-2 pb-2 shadow-xl" style={{ boxShadow: `0 18px 40px rgba(0,0,0,0.4), 0 0 0 2px ${accent}55` }}>
      <div className="overflow-hidden rounded-[16px]" style={{ height: h }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="kenburns h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-black/20 text-xs text-white/70">imagem indisponível</div>
        )}
      </div>
      {caption ? <p className="px-2 pb-1 pt-2 text-center text-[13px] italic text-gray-700">{caption}</p> : null}
    </div>
  );
}
