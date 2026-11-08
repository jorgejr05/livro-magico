"use client";

import { Clapperboard, Images, Loader2, Maximize2, Minimize2, Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoverCanvas } from "./CoverCanvas";
import { buildJob } from "@/lib/render/job";
import { createVideo } from "@/lib/render/client";
import { COVER_SEC, layout, stateAt } from "@/lib/render/scene";
import type { Answers, Result } from "@/lib/types";

const GOLD = "#d9b36a";

// Player em tela cheia: capa de livro fechado, imagens ocupando a tela com a legenda só do que está sendo dito
// ou cantado, e o livro fechado de novo no final. O palco tem proporção fixa e é escalado para caber inteiro
// (nunca corta), então funciona igual em celular, computador e TV.
export function Cinema({ result, answers, onRestart, headers }: { result: Result; answers: Answers; onRestart: () => void; headers: Record<string, string> }) {
  const { story, images } = result;
  const accent = "#ffe3a3";
  const gallery = useMemo(() => images.filter((x): x is string => Boolean(x)), [images]);
  const job = useMemo(() => buildJob(result, answers, gallery.length), [result, answers, gallery.length]);
  const th = job.theme;

  /* ---------- palco escalado ---------- */
  const rootRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: 1280, h: 720 });
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const upd = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    upd();
    window.addEventListener("resize", upd);
    const fs = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", fs);
    return () => {
      window.removeEventListener("resize", upd);
      document.removeEventListener("fullscreenchange", fs);
    };
  }, []);
  const portrait = vp.h > vp.w * 1.05;
  const W = portrait ? 900 : 1600;
  const H = portrait ? 1600 : 900;
  const scale = Math.min(vp.w / W, vp.h / H);
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  /* ---------- áudio ---------- */
  const narr = useRef<HTMLAudioElement>(null);
  const music = useRef<HTMLAudioElement>(null);
  const [phase, setPhase] = useState<"cover" | "intro" | "story" | "finale" | "end">("cover");
  const [introStart, setIntroStart] = useState<number | null>(null);
  const introTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (introTimer.current) clearTimeout(introTimer.current); }, []);
  const [narrNow, setNarrNow] = useState(0);
  const [musicT, setMusicT] = useState(0);
  const [narrDur, setNarrDur] = useState(0);
  const [musicDur, setMusicDur] = useState(0);
  const [narrPlaying, setNarrPlaying] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);

  const tm = useMemo(() => ({ narrDur: narrDur || 0.1, musicDur: musicDur || 8 }), [narrDur, musicDur]);
  const L = layout(tm);
  const T = phase === "cover" || phase === "intro" ? 0 : phase === "story" ? L.narrAt + narrNow : phase === "finale" ? L.finaleAt + musicT : L.endAt + 1;
  const st = stateAt(job, tm, T);

  // O navegador só avisa o tempo do áudio ~4 vezes por segundo; para a palavra acender na hora certa, lê a cada quadro.
  useEffect(() => {
    if (!narrPlaying && !musicPlaying) return;
    let raf = 0;
    const tick = () => {
      if (narrPlaying && narr.current) setNarrNow(narr.current.currentTime);
      if (musicPlaying && music.current) setMusicT(music.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [narrPlaying, musicPlaying]);

  const startFinale = useCallback(() => {
    const m = music.current;
    if (!m) return setPhase("end");
    setPhase("finale");
    m.muted = false;
    m.currentTime = 0;
    m.play().catch(() => {});
  }, []);

  const start = () => {
    // "Destrava" a música durante o toque do usuário para ela poder tocar sozinha depois da narração.
    const m = music.current;
    if (m) {
      m.muted = true;
      m.play().then(() => { m.pause(); m.currentTime = 0; m.muted = false; }).catch(() => { m.muted = false; });
    }
    setNarrNow(0);
    setMusicT(0);
    const el = narr.current;
    if (el) {
      // A narração também é "destravada" no toque; ela só começa depois da abertura animada da capa.
      el.muted = true;
      el.play().then(() => { el.pause(); el.currentTime = 0; el.muted = false; }).catch(() => { el.muted = false; });
      setPhase("intro");
      setIntroStart(performance.now());
      if (introTimer.current) clearTimeout(introTimer.current);
      introTimer.current = setTimeout(() => {
        setPhase("story");
        el.muted = false;
        el.currentTime = 0;
        el.play().catch(() => {});
      }, COVER_SEC * 1000);
    } else {
      startFinale();
    }
  };

  const playPause = () => {
    if (phase === "intro") return;
    if (phase === "cover" || phase === "end") return start();
    const a = phase === "story" ? narr.current : music.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };
  const playing = phase === "story" ? narrPlaying : phase === "finale" ? musicPlaying : false;

  /* ---------- salvar ---------- */
  const [shareFiles, setShareFiles] = useState<File[]>([]);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const files: File[] = [];
        for (let i = 0; i < gallery.length; i++) {
          const img = new Image();
          img.src = gallery[i];
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext("2d")!.drawImage(img, 0, 0);
          const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
          if (blob) files.push(new File([blob], `${story.titulo.replace(/[^\p{L}\p{N}]+/gu, "-")}-${i + 1}.jpg`, { type: "image/jpeg" }));
        }
        if (dead) return;
        setShareFiles(files);
        setCanShare(Boolean(files.length && navigator.canShare?.({ files })));
      } catch {
        /* sem suporte: fica só o zip */
      }
    })();
    return () => { dead = true; };
  }, [gallery, story.titulo]);

  // Celular: abre o menu "Salvar imagens" (vai para a galeria). Computador: baixa cada imagem como arquivo.
  const saveToGallery = async () => {
    if (canShare) {
      try {
        await navigator.share({ files: shareFiles, title: story.titulo });
      } catch {
        /* fechou o menu */
      }
      return;
    }
    shareFiles.forEach((f, i) =>
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(f);
        a.download = f.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      }, i * 350),
    );
  };

  const [vStage, setVStage] = useState<"idle" | "enviando" | "montando" | "pronto" | "erro">("idle");
  const [vFile, setVFile] = useState<File | null>(null);
  const [vUrl, setVUrl] = useState("");
  const makeVideo = async () => {
    setVStage("enviando");
    try {
      const url = await createVideo({ result, answers, jpegs: shareFiles, headers, onStage: (s) => setVStage(s) });
      setVUrl(url);
      try {
        const blob = await (await fetch(url)).blob();
        setVFile(new File([blob], `${story.titulo.replace(/[^\p{L}\p{N}]+/gu, "-")}.mp4`, { type: "video/mp4" }));
      } catch {
        /* sem o arquivo local, baixa pelo link */
      }
      setVStage("pronto");
    } catch {
      setVStage("erro");
    }
  };
  const videoStarted = useRef(false);
  useEffect(() => {
    if (shareFiles.length && !videoStarted.current) {
      videoStarted.current = true;
      makeVideo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareFiles]);
  const saveVideo = async () => {
    if (vFile && navigator.canShare?.({ files: [vFile] })) {
      try {
        await navigator.share({ files: [vFile], title: story.titulo });
      } catch {
        /* fechou o menu */
      }
      return;
    }
    const a = document.createElement("a");
    a.href = vFile ? URL.createObjectURL(vFile) : vUrl;
    a.download = `${story.titulo}.mp4`;
    a.click();
  };

  /* ---------- peças visuais ---------- */
  const sparks = (count = 16) =>
    Array.from({ length: count }).map((_, k) => (
      <span
        key={k}
        className="twinkle absolute rounded-full"
        style={{ left: `${(k * 37) % 96}%`, top: `${(k * 53) % 92}%`, width: 5 + (k % 3) * 3, height: 5 + (k % 3) * 3, background: th.accent, animationDelay: `${(k % 5) * 0.6}s`, pointerEvents: "none" }}
      />
    ));

  const book = (end: boolean) => (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: `radial-gradient(circle at 50% 40%, ${th.from}, ${th.to})` }}>
      {gallery[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={gallery[0]} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: "blur(40px)", opacity: 0.35, transform: "scale(1.2)" }} />
      ) : null}
      {sparks(22)}
      <div
        className="relative"
        style={{
          width: portrait ? 780 : 820,
          height: portrait ? 1260 : 800,
          borderRadius: 26,
          background: "linear-gradient(135deg,#6b4328,#3f2614)",
          boxShadow: "0 40px 90px rgba(0,0,0,.6)",
        }}
      >
        <div className="absolute inset-y-0 left-0" style={{ width: 60, background: "linear-gradient(90deg,rgba(0,0,0,.5),rgba(0,0,0,0))", borderRadius: "26px 0 0 26px" }} />
        <div className="absolute flex flex-col items-center justify-center text-center" style={{ inset: 34, border: `3px solid ${GOLD}`, borderRadius: 14, padding: 30, gap: portrait ? 44 : 30 }}>
          <p style={{ color: GOLD, letterSpacing: "0.3em", fontSize: portrait ? 24 : 20, textTransform: "uppercase" }}>
            {end ? "Fim · com muito amor" : `Um livro de aventura para os ${job.age} aninhos`}
          </p>
          {gallery[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gallery[0]} alt="" style={{ width: portrait ? 560 : 390, height: portrait ? 560 : 390, objectFit: "cover", border: `7px solid ${GOLD}` }} />
          ) : null}
          <p className="font-semibold" style={{ color: "#f3d58f", fontSize: end ? (portrait ? 54 : 44) : portrait ? 56 : 46, lineHeight: 1.15 }}>
            {end ? job.cartao.titulo : job.title}
          </p>
          {end ? <p style={{ color: "rgba(255,255,255,.85)", fontSize: 26 }}>{job.cartao.subtitulo}</p> : null}
        </div>
      </div>
    </div>
  );

  const imgBox = portrait ? { top: 190, left: 0, width: 900, height: 900 } : { top: 0, left: 350, width: 900, height: 900 };
  const full = (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "#000" }}>
      {/* fundo desfocado com a própria imagem */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={gallery[st.cur % gallery.length]} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: "blur(40px) brightness(.55)", transform: "scale(1.3)" }} />
      <div className="absolute overflow-hidden" style={imgBox}>
        {st.prev !== st.cur ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gallery[st.prev % gallery.length]} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={st.cur} src={gallery[st.cur % gallery.length]} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ animation: "kenburns 14s ease-in-out infinite alternate, fadeIn .6s ease both" }} />
      </div>
      {!portrait ? <div className="absolute inset-x-0 bottom-0" style={{ height: 340, background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.72))" }} /> : null}
      {st.sub ? (
        <div
          className="absolute text-center font-bold text-white"
          style={{
            left: portrait ? 60 : 160,
            right: portrait ? 60 : 160,
            ...(portrait ? { top: 1180 } : { bottom: 44 }),
            fontSize: portrait ? 56 : 46,
            lineHeight: 1.4,
            textShadow: "0 2px 14px rgba(0,0,0,.85)",
            fontFamily: '"Poppins", "Helvetica Now Var", Helvetica, Arial, sans-serif',
          }}
        >
          {st.sub.map((w, i) => (
            <span key={i} style={{ opacity: w.on ? 1 : 0, color: w.cur ? accent : "#fff", transition: "opacity .15s" }}>
              {w.w}{" "}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );

  const coverStage = (
    <CoverCanvas job={job} src={gallery[0]} W={W} H={H} introStart={phase === "intro" ? introStart : null} />
  );
  const stage = !gallery.length ? book(phase === "end") : phase === "cover" || phase === "intro" ? coverStage : phase === "end" ? book(true) : full;

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] overflow-hidden" style={{ background: "#0b0805" }}>
      <div className="absolute left-1/2 top-1/2 overflow-hidden" style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center", background: "#000" }}>
        {stage}
      </div>

      {/* controles */}
      <div className="absolute inset-x-0 bottom-3 z-10 flex flex-wrap items-center justify-center gap-2 px-3 text-sm text-white">
        <button type="button" onClick={playPause} className="liquid-glass-selected flex items-center gap-2 rounded-full px-5 py-2.5">
          <span className="relative z-10 flex items-center gap-2">
            {phase === "end" ? <RotateCcw size={16} /> : playing ? <Pause size={16} /> : <Play size={16} />}
            {phase === "intro" ? "Começando…" : phase === "cover" ? "Ouvir a história" : phase === "end" ? "Ver de novo" : playing ? "Pausar" : "Continuar"}
          </span>
        </button>
        <button type="button" onClick={toggleFs} aria-label="Tela cheia" className="liquid-glass rounded-full p-2.5">
          <span className="relative z-10">{isFs ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</span>
        </button>
        {phase === "end" ? (
          <>
            {vStage === "pronto" ? (
              <button type="button" onClick={saveVideo} className="liquid-glass-selected flex items-center gap-2 rounded-full px-5 py-2.5">
                <span className="relative z-10 flex items-center gap-2"><Clapperboard size={16} />Salvar vídeo</span>
              </button>
            ) : vStage === "erro" ? (
              <button type="button" onClick={makeVideo} className="liquid-glass-selected flex items-center gap-2 rounded-full px-5 py-2.5">
                <span className="relative z-10 flex items-center gap-2"><Clapperboard size={16} />Tentar o vídeo de novo</span>
              </button>
            ) : (
              <button type="button" disabled className="liquid-glass flex items-center gap-2 rounded-full px-5 py-2.5 opacity-80">
                <span className="relative z-10 flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Preparando o vídeo…</span>
              </button>
            )}
            <button type="button" onClick={saveToGallery} disabled={!shareFiles.length} className="liquid-glass-selected flex items-center gap-2 rounded-full px-5 py-2.5 disabled:opacity-60">
              <span className="relative z-10 flex items-center gap-2"><Images size={16} />Salvar imagens</span>
            </button>
            <button type="button" onClick={onRestart} className="liquid-glass rounded-full px-4 py-2.5">
              <span className="relative z-10">Criar outro livro</span>
            </button>
          </>
        ) : null}
      </div>

      {phase === "end" && (vStage === "montando" || vStage === "enviando") ? (
        <p className="absolute inset-x-0 bottom-20 z-10 mx-auto max-w-md px-4 text-center text-xs text-white/80">
          Estamos montando o vídeo com a narração e a música. Leva alguns minutos; mantenha esta página aberta.
        </p>
      ) : phase === "end" && vStage === "erro" ? (
        <p className="absolute inset-x-0 bottom-20 z-10 mx-auto max-w-md px-4 text-center text-xs text-white/80">
          Não conseguimos montar o vídeo agora. Tente de novo; as imagens continuam disponíveis para salvar.
        </p>
      ) : null}
      {result.photoProblem && phase === "end" ? (
        <p className="absolute inset-x-0 top-3 z-10 mx-auto max-w-md px-4 text-center text-xs text-white/80">
          Algumas fotos não puderam virar imagem. Para um livro completo, crie outro com fotos de frente, bem iluminadas e com a criança vestida.
        </p>
      ) : null}

      {result.narrationUrl ? (
        <audio
          ref={narr}
          src={result.narrationUrl}
          preload="auto"
          onLoadedMetadata={(e) => setNarrDur(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setNarrNow(e.currentTarget.currentTime)}
          onPlay={() => setNarrPlaying(true)}
          onPause={() => setNarrPlaying(false)}
          onEnded={() => { setNarrPlaying(false); startFinale(); }}
        />
      ) : null}
      {result.musicUrl ? (
        <audio
          ref={music}
          src={result.musicUrl}
          preload="auto"
          onLoadedMetadata={(e) => setMusicDur(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setMusicT(e.currentTarget.currentTime)}
          onPlay={() => setMusicPlaying(true)}
          onPause={() => setMusicPlaying(false)}
          onEnded={() => { setMusicPlaying(false); setPhase("end"); }}
        />
      ) : null}
    </div>
  );
}
