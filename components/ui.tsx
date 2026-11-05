"use client";

import { ArrowRight, Check } from "lucide-react";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";

export const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

/* ---------- cartões de seleção (única ou múltipla) ---------- */
export function SelectionGrid({
  items,
  selected,
  onToggle,
  baseDelay = 0.4,
}: {
  items: { id: string; label: string; hint?: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  baseDelay?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it, i) => {
        const on = selected.includes(it.id);
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onToggle(it.id)}
            aria-pressed={on}
            className={`fade-up flex h-[100px] flex-col justify-between rounded-[32px] p-4 text-left transition-colors ${
              on ? "liquid-glass-selected" : "liquid-glass"
            }`}
            style={delay(baseDelay + i * 0.08)}
          >
            <span className="relative z-10 flex items-center justify-between text-[11px] font-medium text-white/50">
              {String(i + 1).padStart(2, "0")}
              {on ? <Check size={12} className="text-white/90" /> : null}
            </span>
            <span className="relative z-10">
              <span className="block text-base font-medium leading-tight text-white">{it.label}</span>
              {it.hint ? <span className="mt-0.5 block text-[11px] text-white/50">{it.hint}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- campos de texto em vidro ---------- */
export function GlassInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const { label, className, ...rest } = props;
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block px-2 text-xs text-white/60">{label}</span> : null}
      <div className="liquid-glass rounded-[24px]">
        <input
          {...rest}
          className={`relative z-10 w-full bg-transparent px-5 py-3.5 text-base text-white outline-none placeholder:text-white/40 ${className ?? ""}`}
        />
      </div>
    </label>
  );
}

export function GlassTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="liquid-glass rounded-[28px]">
      <textarea
        {...props}
        className="relative z-10 block h-[150px] w-full resize-none bg-transparent px-5 py-4 text-base text-white outline-none placeholder:text-white/40"
      />
    </div>
  );
}

export function GlassPill({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`liquid-glass inline-flex items-center gap-2 rounded-full px-3 py-2.5 ${className ?? ""}`}>{children}</div>;
}

/* ---------- botão de voz (ditado por reconhecimento de fala do navegador) ---------- */
export function VoiceButton({
  onText,
  label = "voz",
}: {
  onText: (text: string) => void;
  label?: string;
}) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Seu navegador não suporta ditado por voz. Digite o texto.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.onresult = (e: any) => onText(String(e.results?.[0]?.[0]?.transcript ?? ""));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div className="fade-up relative my-6 flex flex-col items-center" style={delay(0.7)}>
      <div
        className="pointer-events-none absolute -top-10 h-28 w-56"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(220,200,80,0.5) 0%, rgba(180,160,40,0.2) 40%, transparent 70%)",
          opacity: listening ? 1 : 0.7,
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={listening ? "Parar de ouvir" : "Falar"}
        className={`liquid-glass relative flex h-16 w-16 items-center justify-center rounded-full ${listening ? "scale-105" : ""} transition-transform`}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="relative z-10">
          <line x1="5" y1="12" x2="5" y2="16" />
          <line x1="10" y1="8" x2="10" y2="20" />
          <line x1="14" y1="4" x2="14" y2="24" />
          <line x1="18" y1="8" x2="18" y2="20" />
          <line x1="23" y1="12" x2="23" y2="16" />
        </svg>
      </button>
      <span className="mt-2 text-xs text-white/70">{listening ? "ouvindo..." : label}</span>
    </div>
  );
}

/* ---------- botão de confirmar (um toque) ---------- */
export function SlideToConfirm({
  label = "Continuar",
  canConfirm = true,
  onConfirm,
  onBlocked,
  baseDelay = 0.85,
}: {
  label?: string;
  canConfirm?: boolean;
  onConfirm: () => void;
  onBlocked?: () => void;
  baseDelay?: number;
}) {
  const [shake, setShake] = useState(false);

  const press = () => {
    if (canConfirm) {
      onConfirm();
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      onBlocked?.();
    }
  };

  return (
    <button
      type="button"
      onClick={press}
      className={`fade-up liquid-glass-selected relative flex h-14 w-full select-none items-center justify-center gap-3 rounded-full px-6 text-[15px] font-medium text-white transition-transform active:scale-[0.98] ${shake ? "shake" : ""}`}
      style={delay(baseDelay)}
    >
      <span className="relative z-10">{label}</span>
      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white">
        <ArrowRight size={16} className="text-gray-800" />
      </span>
    </button>
  );
}
