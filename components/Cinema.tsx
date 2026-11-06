"use client";

import { Clapperboard, Download, Images, Maximize2, Minimize2, Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadAll } from "@/lib/download";
import { createVideo } from "@/lib/render/client";
import { getTheme } from "@/lib/themes";
import type { Answers, Result } from "@/lib/types";

const INK = "#3b2a1c";
const PAPER = "#fbf4e4";
const SERIF = 'Georgia, "Lora", "Times New Roman", serif';

// Player em tela cheia no estilo do livro-vídeo: capa, livro aberto com fotos coladas, texto que acende
// com a voz e final com as imagens e a letra. O palco tem proporção fixa e é escalado para caber
// inteiro na tela (nunca corta).
export function Cinema({ result, answers, onRestart, headers }: { result: Result; answers: Answers; onRestart: () => void; headers: Record<string, string> }) {
  const { story, images } = result;
  const theme = getTheme(answers.themeId);
  const accent = theme.colors.accent;
  const hi = theme.colors.from;
  const pages = story.paginas;
  const n = pages.length;
  const gallery = useMemo(() => images.filter((x): x is string => Boolean(x)), [images]);
  const times = result.narrTimes && result.narrTimes.length === n ? result.narrTimes : null;

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
  const [phase, setPhase] = useState<"cover" | "story" | "finale">("cover");
  const [page, setPage] = useState(0);
  const [narrNow, setNarrNow] = useState(0);
  const [local, setLocal] = useState(0);
  const [narrPlaying, setNarrPlaying] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicT, setMusicT] = useState(0);
  const [musicFrac, setMusicFrac] = useState(0);
  const [musicEnded, setMusicEnded] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [shareFiles, setShareFiles] = useState<File[]>([]);
  const [canShare, setCanShare] = useState(false);

  // Converte as imagens para JPEG (a galeria do iPhone não aceita webp) e deixa prontas para o menu de compartilhar.
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

  // ----- vídeo MP4 montado no servidor -----
  const [vStage, setVStage] = useState<"idle" | "enviando" | "montando" | "pronto" | "erro">("idle");
  const [vFile, setVFile] = useState<File | null>(null);
  const [vUrl, setVUrl] = useState("");
  const makeVideo = async () => {
    setVStage("enviando");
    try {
      const url = await createVideo({ result, answers, jpegs: shareFiles, headers, onStage: (st) => setVStage(st) });
      setVUrl(url);
      try {
        // Já deixa o arquivo na memória: o menu de compartilhar do celular exige que o toque seja imediato.
        const blob = await (await fetch(url)).blob();
        setVFile(new File([blob], `${story.titulo.replace(/[^\p{L}\p{N}]+/gu, "-")}.mp4`, { type: "video/mp4" }));
      } catch {
        /* sem o arquivo local, o botão baixa pelo link */
      }
      setVStage("pronto");
    } catch {
      setVStage("erro");
    }
  };
  const saveVideo = async () => {
    if (vFile && navigator.canShare?.({ files: [vFile] })) {
      try {
        await navigator.share({ files: [vFile], title: story.titulo });
        return;
      } catch {
        return; // fechou o menu
      }
    }
    const a = document.createElement("a");
    a.href = vFile ? URL.createObjectURL(vFile) : vUrl;
    a.download = `${story.titulo}.mp4`;
    a.click();
  };

  const saveToGallery = async () => {
    try {
      await navigator.share({ files: shareFiles, title: story.titulo });
    } catch {
      /* usuário fechou o menu */
    }
  };

  const startFinale = useCallback(() => {
    setPhase("finale");
    setMusicEnded(false);
    const m = music.current;
    if (m) {
      m.muted = false;
      m.currentTime = 0;
      m.play().catch(() => {});
    }
  }, []);

  const start = () => {
    // "Destrava" a música durante o toque do usuário para ela poder tocar sozinha no final.
    const m = music.current;
    if (m) {
      m.muted = true;
      m.play().then(() => { m.pause(); m.currentTime = 0; m.muted = false; }).catch(() => { m.muted = false; });
    }
    setPhase("story");
    setPage(0);
    setLocal(0);
    const el = narr.current;
    if (el) {
      el.currentTime = 0;
      el.play().catch(() => {});
    } else {
      startFinale();
    }
  };

  const onNarrTime = () => {
    const el = narr.current;
    if (!el || !el.duration) return;
    const t = el.currentTime;
    setNarrNow(t);
    if (times) {
      let i = 0;
      for (let k = 0; k < n; k++) if (t >= times[k].start - 0.05) i = k;
      const end = i + 1 < n ? times[i + 1].start : el.duration;
      setPage(i);
      setLocal(Math.min(1, Math.max(0, (t - times[i].start) / (end - times[i].start || 1))));
    } else {
      const f = t / el.duration;
      const i = Math.min(n - 1, Math.floor(f * n));
      setPage(i);
      setLocal(f * n - i);
    }
  };

  const onMusicTime = () => {
    const m = music.current;
    if (!m) return;
    setMusicT(m.currentTime);
    setMusicFrac(m.duration ? m.currentTime / m.duration : 0);
  };

  const playPause = () => {
    if (phase === "cover") return start();
    if (phase === "story") {
      const el = narr.current;
      if (!el) return;
      if (el.paused) el.play().catch(() => {});
      else el.pause();
      return;
    }
    const m = music.current;
    if (!m) return;
    if (musicEnded) return replay();
    if (m.paused) m.play().catch(() => {});
    else m.pause();
  };

  const replay = () => {
    music.current?.pause();
    setMusicEnded(false);
    setMusicT(0);
    start();
  };

  const doDownload = async () => {
    setZipping(true);
    try {
      await downloadAll(result);
    } finally {
      setZipping(false);
    }
  };

  const playing = phase === "story" ? narrPlaying : phase === "finale" ? musicPlaying && !musicEnded : false;

  /* ---------- peças visuais ---------- */
  const sparks = (count = 16) =>
    Array.from({ length: count }).map((_, k) => (
      <span
        key={k}
        className="twinkle absolute rounded-full"
        style={{
          left: `${(k * 37) % 96}%`,
          top: `${(k * 53) % 92}%`,
          width: 5 + (k % 3) * 3,
          height: 5 + (k % 3) * 3,
          background: accent,
          animationDelay: `${(k % 5) * 0.6}s`,
          pointerEvents: "none",
        }}
      />
    ));

  const polaroid = (src: string, w: number, rotate: number, key?: string | number) => (
    <div key={key} className="relative" style={{ width: w, transform: `rotate(${rotate}deg)`, filter: "drop-shadow(0 18px 30px rgba(0,0,0,.35))" }}>
      <div className="absolute left-1/2 z-10 h-9 w-32 -translate-x-1/2 rounded-sm" style={{ top: -16, background: `${accent}d9`, transform: "rotate(-3deg)" }} />
      <div style={{ background: "#fff", padding: w * 0.045, paddingBottom: w * 0.045 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="fade-in block w-full" style={{ aspectRatio: "1/1", objectFit: "cover" }} />
      </div>
    </div>
  );

  const renderText = (i: number) => {
    const words = pages[i].texto.split(" ").filter(Boolean);
    const tw = times && times[i].words.length === words.length ? times[i].words : null;
    return words.map((w, k) => {
      let on: boolean;
      let current = false;
      if (tw) {
        on = narrNow >= tw[k].s - 0.02;
        current = on && narrNow <= tw[k].e + 0.12;
      } else {
        on = local >= k / words.length;
        current = on && local < (k + 1) / words.length;
      }
      return (
        <span key={k} style={{ opacity: on ? 1 : 0.25, color: current ? hi : INK, fontWeight: current ? 700 : 500, marginRight: "0.28em", transition: "all .2s" }}>
          {w}
        </span>
      );
    });
  };

  /* ---------- cenas ---------- */
  const cover = (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ background: `radial-gradient(circle at 50% 40%, ${theme.colors.from}, ${theme.colors.to})` }}>
      {gallery[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={gallery[0]} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: "blur(28px) brightness(.55)", transform: "scale(1.15)" }} />
      ) : null}
      {sparks(22)}
      <p className="relative" style={{ color: accent, letterSpacing: "0.35em", fontSize: portrait ? 26 : 24, textTransform: "uppercase" }}>
        Um livro de aventura para os {answers.age} aninhos
      </p>
      <h1 className="relative mt-6 px-10 font-semibold text-white" style={{ fontSize: portrait ? 84 : 96, lineHeight: 1.05 }}>
        {story.titulo}
      </h1>
      {gallery[0] ? <div className="relative mt-12">{polaroid(gallery[0], portrait ? 520 : 400, -2)}</div> : null}
    </div>
  );

  const bookPage = (i: number) => {
    const imgs = chunks[i];
    const active = imgs.length ? Math.min(imgs.length - 1, Math.floor(local * imgs.length)) : 0;
    const imgNode = imgs.length ? polaroid(imgs[active], portrait ? 560 : 520, i % 2 ? 2 : -2, `${i}-${active}`) : null;
    const textNode = (
      <div key={`t${i}`} className="px-4" style={{ fontFamily: SERIF }}>
        <p style={{ color: "#c0453a", letterSpacing: "0.3em", fontSize: 22, textTransform: "uppercase", textAlign: "center" }}>{pages[i].capitulo}</p>
        <div className="mx-auto my-4 h-px w-40" style={{ background: "#c0453a66" }} />
        <p style={{ fontSize: portrait ? 44 : 40, lineHeight: 1.55 }}>{renderText(i)}</p>
        <p className="mt-6 text-center" style={{ fontSize: 20, opacity: 0.5 }}>— {i + 1} —</p>
      </div>
    );
    const left = i % 2 === 0 ? imgNode : textNode;
    const right = i % 2 === 0 ? textNode : imgNode;
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(160deg, ${theme.colors.to}, #1a1208)` }}>
        {sparks(12)}
        <div
          key={i}
          className="page-in relative flex overflow-hidden"
          style={{
            width: portrait ? 820 : 1480,
            height: portrait ? 1440 : 800,
            borderRadius: 28,
            background: PAPER,
            color: INK,
            border: "14px solid #6b4328",
            boxShadow: "0 30px 80px rgba(0,0,0,.55)",
            flexDirection: portrait ? "column" : "row",
          }}
        >
          <div className="flex flex-1 items-center justify-center" style={{ padding: 36 }}>{portrait ? imgNode : left}</div>
          {portrait ? null : <div style={{ width: 2, background: "linear-gradient(to bottom, transparent, #0002, transparent)" }} />}
          <div className="flex flex-1 items-center justify-center" style={{ padding: 36 }}>{portrait ? textNode : right}</div>
        </div>
      </div>
    );
  };

  const ls = result.lyricStarts && result.lyricStarts.length === story.letra.length ? result.lyricStarts : null;
  let lyricIdx = Math.min(story.letra.length - 1, Math.floor(musicFrac * story.letra.length));
  if (ls) {
    lyricIdx = 0;
    for (let k = 0; k < ls.length; k++) if (musicT >= ls[k] - 0.1) lyricIdx = k;
  }
  const slideIdx = gallery.length ? Math.floor(musicT / 4) % gallery.length : 0;
  const showEnd = musicEnded || musicFrac > 0.93;

  const finale = (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(circle at 50% 35%, ${theme.colors.from}, ${theme.colors.to})` }}>
      {sparks(24)}
      {gallery.length ? (
        <>
          {[1, 2, 3, 4].map((o) => {
            const g = gallery[(slideIdx + o) % gallery.length];
            const pos = portrait
              ? [{ left: 20, top: 90 }, { right: 20, top: 120 }, { left: 30, bottom: 360 }, { right: 30, bottom: 330 }][o - 1]
              : [{ left: 90, top: 90 }, { right: 90, top: 110 }, { left: 140, bottom: 150 }, { right: 140, bottom: 130 }][o - 1];
            return (
              <div key={o} className="absolute" style={{ ...pos, opacity: 0.9 }}>
                {polaroid(g, portrait ? 280 : 300, [-7, 6, 5, -6][o - 1], `${o}-${slideIdx}`)}
              </div>
            );
          })}
          <div className="absolute left-1/2 -translate-x-1/2" style={{ top: portrait ? 330 : 70 }}>
            {polaroid(gallery[slideIdx], portrait ? 520 : 480, 0, `c-${slideIdx}`)}
          </div>
        </>
      ) : null}
      <div className="absolute inset-x-0 text-center text-white" style={{ bottom: portrait ? 120 : 50, padding: "0 60px" }}>
        {showEnd ? (
          <div className="fade-in">
            <p className="font-semibold" style={{ fontSize: portrait ? 64 : 62, color: "#ffe3a3" }}>{story.cartao_final.titulo}</p>
            <p style={{ fontSize: 28, opacity: 0.9, marginTop: 8 }}>{story.cartao_final.subtitulo}</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 24, opacity: 0.55 }}>{story.letra[Math.max(0, lyricIdx - 1)]}</p>
            <p key={lyricIdx} className="fade-in font-semibold" style={{ fontSize: portrait ? 50 : 46, lineHeight: 1.2, marginTop: 6, textShadow: "0 2px 14px rgba(0,0,0,.6)" }}>
              {story.letra[lyricIdx]}
            </p>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] overflow-hidden" style={{ background: "#0b0805" }}>
      {/* palco com proporção fixa, escalado para caber inteiro */}
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden"
        style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center", background: "#000" }}
      >
        {phase === "cover" ? cover : phase === "story" ? bookPage(page) : finale}
      </div>

      {/* controles */}
      <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-2 px-3 text-sm text-white">
        <button type="button" onClick={playPause} className="liquid-glass-selected flex items-center gap-2 rounded-full px-5 py-2.5">
          <span className="relative z-10 flex items-center gap-2">
            {phase === "cover" ? <Play size={16} /> : playing ? <Pause size={16} /> : musicEnded ? <RotateCcw size={16} /> : <Play size={16} />}
            {phase === "cover" ? "Ouvir a história" : playing ? "Pausar" : musicEnded ? "Ver de novo" : "Continuar"}
          </span>
        </button>
        <button type="button" onClick={toggleFs} aria-label="Tela cheia" className="liquid-glass rounded-full p-2.5">
          <span className="relative z-10">{isFs ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</span>
        </button>
        {(phase === "finale" || phase === "story") && shareFiles.length && vStage !== "pronto" ? (
          <button type="button" onClick={makeVideo} disabled={vStage === "enviando" || vStage === "montando"} className="liquid-glass-selected flex items-center gap-2 rounded-full px-4 py-2.5 disabled:opacity-70">
            <span className="relative z-10 flex items-center gap-2">
              <Clapperboard size={16} />
              {vStage === "enviando" ? "Enviando…" : vStage === "montando" ? "Montando o vídeo…" : vStage === "erro" ? "Tentar o vídeo de novo" : "Criar vídeo"}
            </span>
          </button>
        ) : null}
        {vStage === "pronto" ? (
          <button type="button" onClick={saveVideo} className="liquid-glass-selected flex items-center gap-2 rounded-full px-4 py-2.5">
            <span className="relative z-10 flex items-center gap-2"><Clapperboard size={16} />Salvar vídeo</span>
          </button>
        ) : null}
        {(phase === "finale" || phase === "story") && canShare ? (
          <button type="button" onClick={saveToGallery} className="liquid-glass-selected flex items-center gap-2 rounded-full px-4 py-2.5">
            <span className="relative z-10 flex items-center gap-2"><Images size={16} />Salvar na galeria</span>
          </button>
        ) : null}
        {phase === "finale" || phase === "story" ? (
          <button type="button" onClick={doDownload} disabled={zipping} className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2.5 disabled:opacity-60">
            <span className="relative z-10 flex items-center gap-2"><Download size={16} />{zipping ? "Preparando…" : canShare ? "Arquivos (zip)" : "Baixar tudo"}</span>
          </button>
        ) : null}
        {phase === "finale" && showEnd ? (
          <button type="button" onClick={onRestart} className="liquid-glass rounded-full px-4 py-2.5">
            <span className="relative z-10">Criar outro livro</span>
          </button>
        ) : null}
      </div>

      {vStage === "montando" || vStage === "enviando" ? (
        <p className="absolute inset-x-0 bottom-16 z-10 mx-auto max-w-md px-4 text-center text-xs text-white/80">
          Estamos montando o seu vídeo (leva 1 a 3 minutos). Pode continuar assistindo; mantenha esta página aberta.
        </p>
      ) : vStage === "erro" ? (
        <p className="absolute inset-x-0 bottom-16 z-10 mx-auto max-w-md px-4 text-center text-xs text-white/80">
          Não conseguimos montar o vídeo agora. Tente de novo; as imagens continuam disponíveis para salvar.
        </p>
      ) : null}

      {result.photoProblem && phase === "finale" && showEnd ? (
        <p className="absolute inset-x-0 top-3 z-10 mx-auto max-w-md px-4 text-center text-xs text-white/80">
          Algumas fotos não puderam virar imagem. Para um livro completo, crie outro com fotos de frente, bem iluminadas e com a criança vestida.
        </p>
      ) : null}

      {result.narrationUrl ? (
        <audio
          ref={narr}
          src={result.narrationUrl}
          preload="auto"
          onTimeUpdate={onNarrTime}
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
          onTimeUpdate={onMusicTime}
          onPlay={() => setMusicPlaying(true)}
          onPause={() => setMusicPlaying(false)}
          onEnded={() => { setMusicPlaying(false); setMusicEnded(true); }}
        />
      ) : null}
    </div>
  );
}
