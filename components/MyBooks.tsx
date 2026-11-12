"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Phone } from "./Phone";
import { GlassInput, GlassPill, delay } from "./ui";

type Row = { id: string; child_name: string; title: string | null; status: string; created_at: string; expires_at: string | null };
const LABEL: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago, criando",
  generating: "Criando",
  done: "Pronto",
  partial: "Pronto",
  failed: "Continuar criando",
  expired: "Expirado",
};

// "Meus livros": o responsável digita nome + WhatsApp e reencontra os pedidos (pagos ou não).
export function MyBooks() {
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const mask = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("lm_contact") || "null");
      if (c?.name) setName(c.name);
      if (c?.whatsapp) setWa(mask(c.whatsapp));
    } catch {}
  }, []);

  const search = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/books/find", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, whatsapp: wa }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não consegui buscar.");
      setRows(d.books as Row[]);
      try { localStorage.setItem("lm_contact", JSON.stringify({ name, whatsapp: wa.replace(/\D/g, "") })); } catch {}
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <Phone>
      <div className="flex h-full flex-col px-6 pb-6 pt-14">
        <div className="fade-up mb-6 flex items-center justify-between" style={delay(0.1)}>
          <GlassPill><span className="relative z-10 text-xs font-medium text-white/90">Livro Mágico</span></GlassPill>
          <a href="/criar" className="text-xs text-white/70 underline">Criar um livro</a>
        </div>
        <div className="fade-up mb-6" style={delay(0.2)}>
          <p className="mb-1.5 text-sm text-white/60">Acesse seus livros</p>
          <h1 className="text-[28px] font-normal leading-[1.1] tracking-tight text-white">Meus livros</h1>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto">
          <GlassInput label="Seu nome" placeholder="O mesmo que você usou no pedido" value={name} onChange={(e) => setName(e.target.value)} />
          <GlassInput label="WhatsApp com DDD" placeholder="(11) 91234-5678" inputMode="tel" value={wa} onChange={(e) => setWa(mask(e.target.value))} />
          <button type="button" onClick={search} disabled={busy} className="liquid-glass-selected flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm text-white disabled:opacity-70">
            <span className="relative z-10 flex items-center gap-2">{busy ? <Loader2 size={16} className="animate-spin" /> : null}Ver meus livros</span>
          </button>
          {err ? <p className="rounded-2xl bg-red-500/30 p-3 text-xs text-white">{err}</p> : null}
          {rows && !rows.length ? <p className="px-1 text-sm text-white/80">Não encontramos livros com esses dados. Confira o nome (o primeiro nome basta) e o número.</p> : null}
          {rows?.map((b) => (
            <a key={b.id} href={`/livro/${b.id}`} className="liquid-glass block rounded-[24px] px-4 py-3.5 text-white">
              <span className="relative z-10 block text-sm font-medium">{b.title || `Livro de ${b.child_name}`}</span>
              <span className="relative z-10 block text-xs text-white/70">
                {LABEL[b.status] || b.status} · {new Date(b.created_at).toLocaleDateString("pt-BR")}
                {b.expires_at && b.status !== "expired" ? ` · disponível até ${new Date(b.expires_at).toLocaleDateString("pt-BR")}` : ""}
              </span>
            </a>
          ))}
        </div>
      </div>
    </Phone>
  );
}
