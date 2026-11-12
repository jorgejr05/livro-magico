"use client";

import { Clapperboard, Images, Loader2, Maximize2, Minimize2, Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildJob } from "@/lib/render/job";
import { COVER_SEC, drawCover, drawFrame, layout } from "@/lib/render/scene";
import { ensureJob, makeVideo, type BookInfo } from "@/lib/bookClient";
import type { Answers, Result } from "@/lib/types";

type VState = { stage: "idle" | "rendering" | "ready" | "error"; file?: File };

// Player único em canvas: é o mesmo desenho do vídeo MP4. Em celular em pé usa as imagens 9:16, em PC/TV/tablet
// deitado usa as 16:9, e o palco é escalado para caber inteiro na tela (sem cortar o texto).
export function Cinema({ result, info, answers, headers }: { result: Result; info: BookInfo; answers: Answers; headers: Record<string, string> }) {
  const { story } = result;

  /* ---------- tela ---------- */
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
  const fmt: "h" | "v" = portrait ? "v" : "h";
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  const setOf = useCallback((f: "h" | "v") => (f === "v" ? result.imagesP ?? result.images : result.images).filter((x): x is string => Boolean(x)), [result]);
  const gallery = useMemo(() => setOf(fmt), [setOf, fmt]);
  const job = useMemo(() => buildJob(result, answers, Math.max(1, gallery.length)), [result, answers, gallery.length]);

  /* ---------- áudio e fases ---------- */
  const narr = useRef<HTMLAudioElement>(null);
  const music = useRef<HTMLAudioElement>(null);
  const [phase, setPhase] = useState<"cover" | "intro" | "story" | "finale" | "end">("cover");
  const [narrDur, setNarrDur] = useState(0);
  const [musicDur, setMusicDur] = useState(0);
  const [narrPlaying, setNarrPlaying] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const introStart = useRef<number | null>(null);
  const introTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (introTimer.current) clearTimeout(introTimer.current); }, []);
  const tm = useMemo(() => ({ narrDur: narrDur || 0.1, musicDur: musicDur || 8 }), [narrDur, musicDur]);

  const startFinale = useCallback(() => {
    const m = music.current;
    if (!m) return setPhase("end");
    setPhase("finale");
    m.muted = false;
    m.currentTime = 0;
    m.play().catch(() => {});
  }, []);

  const start = () => {
    // "Destrava" os dois áudios no toque do usuário: o navegador só deixa tocar sozinho depois disso.
    for (const el of [music.current, narr.current]) {
      if (!el) continue;
      el.muted = true;
      el.play().then(() => { el.pause(); el.currentTime = 0; el.muted = false; }).catch(() => { el.muted = false; });
    }
    const el = narr.current;
    if (!el) return startFinale();
    setPhase("intro");
    introStart.current = performance.now();
    if (introTimer.current) clearTimeout(introTimer.current);
    introTimer.current = setTimeout(() => {
      setPhase("story");
      el.muted = false;
      el.currentTime = 0;
      el.play().catch(() => {});
    }, COVER_SEC * 1000);
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

  /* ---------- desenho (um quadro por requestAnimationFrame) ---------- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ phase, job, tm, imgs: [] as HTMLImageElement[] });
  live.current.phase = phase;
  live.current.job = job;
  live.current.tm = tm;
  useEffect(() => {
    let dead = false;
    Promise.all(
      gallery.map(
        (src) =>
          new Promise<HTMLImageElement | null>((res) => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = () => res(null);
            im.src = src;
          }),
      ),
    ).then((list) => {
      if (!dead) live.current.imgs = list.filter((x): x is HTMLImageElement => Boolean(x));
    });
    return () => { dead = true; };
  }, [gallery]);
  useEffect(() => {
    document.fonts?.load("700 40px Poppins").catch(() => {});
    document.fonts?.load("500 24px Poppins").catch(() => {});
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const mk = (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: w, height: h });
    const mount = performance.now();
    let raf = 0;
    const tick = () => {
      const { phase: ph, job: jb, tm: t, imgs } = live.current;
      const now = performance.now();
      const L = layout(t);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.shadowColor = "transparent";
      if (ph === "cover") drawCover(ctx, mk, imgs[0], jb, (now - mount) / 1000, W, H);
      else if (ph === "intro") drawCover(ctx, mk, imgs[0], jb, (now - (introStart.current ?? now)) / 1000, W, H);
      else if (ph === "story") drawFrame(ctx, mk, imgs, jb, t, L.narrAt + (narr.current?.currentTime ?? 0), W, H);
      else if (ph === "finale") drawFrame(ctx, mk, imgs, jb, t, L.finaleAt + (music.current?.currentTime ?? 0), W, H);
      else drawFrame(ctx, mk, imgs, jb, t, L.endAt + 1 + (now - mount) / 1000, W, H);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [W, H]);

  /* ---------- imagens para salvar (JPEG, no formato da tela) ---------- */
  const [files, setFiles] = useState<Record<"h" | "v", File[]>>({ h: [], v: [] });
  useEffect(() => {
    let dead = false;
    (async () => {
      const out: Record<"h" | "v", File[]> = { h: [], v: [] };
      for (const f of ["v", "h"] as const) {
        const list = setOf(f);
        for (let i = 0; i < list.length; i++) {
          try {
            const im = new Image();
            im.src = list[i];
            await im.decode();
            const c = document.createElement("canvas");
            c.width = im.naturalWidth;
            c.height = im.naturalHeight;
            c.getContext("2d")!.drawImage(im, 0, 0);
            const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
            if (blob) out[f].push(new File([blob], `${story.titulo.replace(/[^\p{L}\p{N}]+/gu, "-")}-${f === "v" ? "celular" : "tv"}-${i + 1}.jpg`, { type: "image/jpeg" }));
          } catch {
            /* pula esta imagem */
          }
        }
        if (dead) return;
        setFiles({ ...out });
      }
    })();
    return () => { dead = true; };
  }, [setOf, story.titulo]);

  const sendFiles = async (list: File[]) => {
    if (!list.length) return;
    if (navigator.canShare?.({ files: list })) {
      try {
        await navigator.share({ files: list, title: story.titulo });
      } catch {
        /* fechou o menu */
      }
      return;
    }
    // computador: baixa cada arquivo (sem zip)
    list.forEach((f, i) =>
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(f);
        a.download = f.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 15000);
      }, i * 350),
    );
  };

  /* ---------- vídeos: o do formato da tela começa a ser montado sozinho ---------- */
  const [vids, setVids] = useState<Record<"h" | "v", VState>>({ h: { stage: "idle" }, v: { stage: "idle" } });
  const started = useRef<Record<string, boolean>>({});
  const renderVideo = useCallback(
    async (f: "h" | "v") => {
      if (started.current[f]) return;
      started.current[f] = true;
      setVids((p) => ({ ...p, [f]: { stage: "rendering" } }));
      try {
        await ensureJob(info, result, answers, headers);
        const file = await makeVideo(info.id, f, headers, story.titulo);
        setVids((p) => ({ ...p, [f]: { stage: "ready", file } }));
      } catch {
        started.current[f] = false;
        setVids((p) => ({ ...p, [f]: { stage: "error" } }));
      }
    },
    [info, result, answers, headers, story.titulo],
  );
  useEffect(() => {
    if (result.narrationUrl || result.musicUrl) renderVideo(fmt);
  }, [fmt, renderVideo, result.narrationUrl, result.musicUrl]);

  const saveVideo = (f: "h" | "v") => {
    const v = vids[f];
    if (v.file) return sendFiles([v.file]);
    renderVideo(f);
  };
  const other: "h" | "v" = fmt === "v" ? "h" : "v";
  const [showOther, setShowOther] = useState(false);
  const vBtn = (f: "h" | "v", label: string, primary: boolean) => {
    const v = vids[f];
    const cls = `${primary ? "liquid-glass-selected px-5" : "liquid-glass px-4"} flex items-center gap-2 rounded-full py-2.5`;
    return (
      <button type="button" onClick={() => saveVideo(f)} disabled={v.stage === "rendering"} className={`${cls} disabled:opacity-80`}>
        <span className="relative z-10 flex items-center gap-2">
          {v.stage === "rendering" ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
          {v.stage === "rendering" ? "Preparando o vídeo…" : v.stage === "error" ? "Tentar o vídeo de novo" : label}
        </span>
      </button>
    );
  };

  const audioProps = {
    preload: "auto" as const,
  };

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] overflow-hidden" style={{ background: "#0b0805" }}>
      <div className="absolute left-1/2 top-1/2 overflow-hidden" style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center", background: "#000" }}>
        <canvas ref={canvasRef} width={W} height={H} className="absolute inset-0 h-full w-full" onClick={() => phase !== "cover" && playPause()} />
      </div>

      <div className="absolute inset-x-0 bottom-3 z-10 flex flex-wrap items-center justify-center gap-2 px-3 text-sm text-white">
        <button type="button" onClick={playPause} disabled={phase === "intro"} className="liquid-glass-selected flex items-center gap-2 rounded-full px-5 py-2.5">
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
            {vBtn(fmt, "Salvar vídeo", true)}
            <button type="button" onClick={() => sendFiles(files[fmt])} disabled={!files[fmt].length} className="liquid-glass-selected flex items-center gap-2 rounded-full px-5 py-2.5 disabled:opacity-60">
              <span className="relative z-10 flex items-center gap-2"><Images size={16} />Salvar imagens</span>
            </button>
            <a href="/criar" className="liquid-glass rounded-full px-4 py-2.5"><span className="relative z-10">Criar outro livro</span></a>
            <button type="button" onClick={() => setShowOther((s) => !s)} className="px-2 py-2.5 text-xs text-white/70 underline">
              {fmt === "v" ? "Versão para TV" : "Versão para celular"}
            </button>
            {showOther ? (
              <div className="flex basis-full flex-wrap items-center justify-center gap-2">
                {vBtn(other, `Vídeo ${other === "v" ? "para celular (vertical)" : "para TV (horizontal)"}`, false)}
                <button type="button" onClick={() => sendFiles(files[other])} disabled={!files[other].length} className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2.5 disabled:opacity-60">
                  <span className="relative z-10 flex items-center gap-2"><Images size={16} />Imagens {other === "v" ? "verticais" : "horizontais"}</span>
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      {phase === "end" && vids[fmt].stage === "rendering" ? (
        <p className="absolute inset-x-0 bottom-24 z-10 mx-auto max-w-md px-4 text-center text-xs text-white/80">
          Estamos montando o vídeo com a narração e a música. Leva alguns minutos; mantenha esta página aberta.
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
          {...audioProps}
          onLoadedMetadata={(e) => setNarrDur(e.currentTarget.duration || 0)}
          onPlay={() => setNarrPlaying(true)}
          onPause={() => setNarrPlaying(false)}
          onEnded={() => { setNarrPlaying(false); startFinale(); }}
        />
      ) : null}
      {result.musicUrl ? (
        <audio
          ref={music}
          src={result.musicUrl}
          {...audioProps}
          onLoadedMetadata={(e) => setMusicDur(e.currentTarget.duration || 0)}
          onPlay={() => setMusicPlaying(true)}
          onPause={() => setMusicPlaying(false)}
          onEnded={() => { setMusicPlaying(false); setPhase("end"); }}
        />
      ) : null}
    </div>
  );
}
