"use client";

import { useEffect, useRef } from "react";
import { COVER_SEC, drawCover, type Job } from "@/lib/render/scene";

// Abertura animada da capa (a mesma arte do vídeo MP4). `introStart` é o instante (performance.now) em que a abertura
// foi iniciada pelo toque; antes disso a capa anima sozinha uma vez e fica esperando o toque.
export function CoverCanvas({ job, src, W, H, introStart }: { job: Job; src?: string; W: number; H: number; introStart: number | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const intro = useRef<number | null>(null);
  intro.current = introStart;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const mk = (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: w, height: h });
    let img: HTMLImageElement | undefined;
    if (src) {
      const i = new Image();
      i.onload = () => (img = i);
      i.src = src;
    }
    const mount = performance.now();
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const t = intro.current != null ? (now - intro.current) / 1000 : (now - mount) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.shadowColor = "transparent";
      drawCover(ctx, mk, img, job, Math.min(t, COVER_SEC + 600), W, H);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [job, src, W, H]);

  return <canvas ref={ref} width={W} height={H} className="absolute inset-0 h-full w-full" />;
}
