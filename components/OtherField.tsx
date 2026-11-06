"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

// Campo "Outro": os pais digitam uma opção que não está na lista; ela entra como escolhida.
export function OtherField({ onAdd, placeholder }: { onAdd: (v: string) => void; placeholder: string }) {
  const [v, setV] = useState("");
  const add = () => {
    if (v.trim().length < 2) return;
    onAdd(v);
    setV("");
  };
  return (
    <div className="fade-up flex items-center gap-2" style={{ animationDelay: "0.9s" }}>
      <div className="liquid-glass flex-1 rounded-[24px]">
        <input
          value={v}
          maxLength={40}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="relative z-10 w-full bg-transparent px-5 py-3.5 text-base text-white outline-none placeholder:text-white/40"
        />
      </div>
      <button type="button" onClick={add} aria-label="Adicionar" className="liquid-glass-selected flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
        <Plus size={18} className="relative z-10" />
      </button>
    </div>
  );
}
