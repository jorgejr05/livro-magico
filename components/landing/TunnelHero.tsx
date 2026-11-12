"use client";

import Link from "next/link";
import { motion, MotionValue, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ARTS, ArtScene, type Art } from "./art";

// Hero em túnel 3D: ao rolar a página, as capas das aventuras voam em direção à tela.
// (Baseado no "Perspective Tunnel Hero"; a rolagem da PÁGINA move o túnel, então nada trava a navegação.)
type Card = { art: Art; cos: number; sin: number; rx: number; ry: number; rot: number; index: number };
const CARDS: Card[] = ARTS.map((art, i) => {
  const a = i * 137.5 * (Math.PI / 180);
  const side = i % 2 === 0 ? -1 : 1; // alterna esquerda/direita: o miolo fica livre para o título
  return { art, cos: side * (0.8 + 0.2 * Math.abs(Math.cos(a))), sin: Math.sin(a), rx: 0.36 + (i % 3) * 0.05, ry: 0.3 + (i % 2) * 0.08, rot: (i % 2 === 0 ? -1 : 1) * (3 + (i % 5) * 2), index: i };
});
const SPRING = { stiffness: 60, damping: 25, mass: 0.5 };

function TunnelCard({ card, progress, pointer, total, stage }: { card: Card; progress: MotionValue<number>; pointer: { x: MotionValue<number>; y: MotionValue<number> }; total: number; stage: { width: number; height: number; mobile: boolean } }) {
  const span = 0.6;
  const start = (card.index / total) * 0.55; // na abertura nenhuma capa cobre o título
  const local = useTransform(progress, [start, start + span], [0, 1]);
  const z = useTransform(local, [0, 1], [stage.mobile ? -1200 : -1700, stage.mobile ? 350 : 520]);
  const opacity = useTransform(local, [0, 0.15, 0.8, 0.98], [0, 1, 1, 0]);
  const w = stage.mobile ? Math.max(130, Math.min(180, stage.width * 0.38)) : Math.max(190, Math.min(280, stage.width * 0.18));
  const bx = card.cos * stage.width * card.rx;
  const by = card.sin * stage.height * card.ry;
  const pan = stage.mobile ? 20 : 45;
  const transform = useTransform([z, pointer.x, pointer.y], ([cz, px, py]: number[]) => `translate3d(calc(-50% + ${bx - px * pan}px), calc(-50% + ${by - py * pan}px), ${cz}px) rotateZ(${card.rot}deg)`);
  return (
    <motion.div style={{ width: w, transform, opacity, zIndex: card.index + 1 }} className="absolute left-1/2 top-1/2 aspect-[4/5] select-none will-change-transform">
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-white p-2 shadow-2xl shadow-black/60 ring-1 ring-white/20">
        <div className="h-full w-full overflow-hidden rounded-xl">
          <ArtScene art={card.art} />
        </div>
        <span className="absolute inset-x-0 bottom-3.5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white drop-shadow-md sm:text-xs">{card.art.title}</span>
      </div>
    </motion.div>
  );
}

export function TunnelHero() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [stage, setStage] = useState({ width: 1440, height: 900, mobile: false });
  useEffect(() => {
    const u = () => setStage({ width: window.innerWidth, height: window.innerHeight, mobile: window.innerWidth < 768 });
    u();
    window.addEventListener("resize", u);
    return () => window.removeEventListener("resize", u);
  }, []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 80, damping: 30, restDelta: 0.0001 });

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const px = useSpring(rawX, SPRING);
  const py = useSpring(rawY, SPRING);
  useEffect(() => {
    if (reduce) return;
    const on = (e: PointerEvent) => {
      rawX.set((e.clientX / window.innerWidth - 0.5) * 2);
      rawY.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, [reduce, rawX, rawY]);

  const headScale = useTransform(progress, [0, 0.15, 0.3], [1, 1.05, 1.15]);
  const headOpacity = useTransform(progress, [0, 0.12, 0.3], [1, 1, 0]);
  const outroOpacity = useTransform(progress, [0.62, 0.8, 1], [0, 1, 1]);
  const outroScale = useTransform(progress, [0.62, 0.9], [0.85, 1]);
  const hint = useTransform(progress, [0, 0.08], [1, 0]);

  return (
    <div ref={ref} className="relative h-[330svh]">
      <div className="sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden text-white" style={{ perspective: stage.mobile ? "900px" : "1200px", transformStyle: "preserve-3d" }}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#312e81_1px,transparent_1px)] opacity-60 [background-size:28px_28px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_55%,transparent_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(129,140,248,0.28)_0%,transparent_65%)]" />
        <div className="pointer-events-none absolute h-[48vmin] w-[48vmin] rounded-full border border-indigo-400/15" />
        <div className="pointer-events-none absolute h-[76vmin] w-[76vmin] rounded-full border border-dashed border-white/10" />

        <motion.div style={{ scale: headScale, opacity: headOpacity }} className="relative z-30 flex max-w-3xl flex-col items-center px-6 pb-10 pt-24 text-center">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-indigo-200 backdrop-blur">
            <Sparkles size={14} className="text-amber-300" /> Livro, narração, música e vídeo com o seu filho como herói
          </span>
          <h1 className="text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Transforme o aniversário do seu filho em uma{" "}
            <span className="shine-text bg-gradient-to-r from-amber-200 via-amber-400 to-pink-300 bg-clip-text text-transparent">aventura inesquecível</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-white/75 sm:text-base">
            Você responde algumas perguntas e envia fotos. A gente cria um livro ilustrado, uma história narrada com emoção e uma música de parabéns só dele(a).
          </p>
          <Link href="/criar" className="group mt-6 inline-flex items-center gap-3 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-8 py-4 text-base font-bold text-amber-950 shadow-[0_10px_40px_-8px_rgba(251,191,36,.7)] transition hover:scale-[1.03]">
            Criar meu livro agora <ArrowRight size={18} className="transition group-hover:translate-x-1" />
          </Link>
          <p className="mt-3 text-xs text-white/50">R$ 29,90 por Pix · funciona no celular, PC e TV</p>
        </motion.div>

        <motion.div style={{ opacity: outroOpacity, scale: outroScale }} className="pointer-events-none absolute z-30 flex max-w-xl flex-col items-center px-6 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-6xl">Toda criança é a estrela de uma história.</h2>
          <p className="mt-4 text-white/70">Escolha uma aventura ou invente a sua. Role para ver como funciona.</p>
        </motion.div>

        <motion.div style={{ opacity: hint }} className="pointer-events-none absolute bottom-3 z-30 hidden flex-col sm:flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/50">
          <span>Role para explorar</span>
          <div className="h-6 w-px bg-gradient-to-b from-amber-300 to-transparent" />
        </motion.div>

        <div className="pointer-events-none absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          {CARDS.map((c) => (
            <TunnelCard key={c.index} card={c} progress={progress} pointer={{ x: px, y: py }} total={CARDS.length} stage={stage} />
          ))}
        </div>
      </div>
    </div>
  );
}
