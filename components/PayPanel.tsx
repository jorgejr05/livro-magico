"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GlassInput } from "./ui";

type Pix = { payload: string; qr: string; value: number };

// Tela do Pix: mostra o QR Code e o "copia e cola" e confere o pagamento a cada 3 segundos.
export function PayPanel({ id, headers, onPaid }: { id: string; headers: Record<string, string>; onPaid: () => void }) {
  const [pix, setPix] = useState<Pix | null>(null);
  const [err, setErr] = useState("");
  const [needCpf, setNeedCpf] = useState(false);
  const [cpf, setCpf] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const done = useRef(false);

  const create = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/pay/create", { method: "POST", headers, body: JSON.stringify({ id, cpf }) });
      const d = await r.json();
      if (d.paid) {
        if (!done.current) { done.current = true; onPaid(); }
        return;
      }
      if (r.status === 422 && d.needCpf) {
        setNeedCpf(true);
        setErr("Para gerar o Pix, o banco pede o CPF do responsável.");
      } else if (!r.ok) {
        throw new Error(d.error || "Não consegui gerar o Pix.");
      } else {
        setNeedCpf(false);
        setPix(d as Pix);
      }
    } catch (e) {
      setErr((e as Error).message);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, headers, cpf, onPaid]);

  useEffect(() => { create(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    if (!pix) return;
    const t = setInterval(async () => {
      try {
        const d = await (await fetch(`/api/pay/status?id=${id}`, { cache: "no-store" })).json();
        if (d.paid && !done.current) { done.current = true; onPaid(); }
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [pix, id, onPaid]);

  const copy = async () => {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* sem permissão: a pessoa copia o texto manualmente */
    }
  };

  return (
    <div className="space-y-4 text-white">
      {loading && !pix ? <div className="flex justify-center pt-8"><Loader2 className="animate-spin text-white/70" /></div> : null}
      {err ? <p className="rounded-2xl bg-red-500/30 p-3 text-xs">{err}</p> : null}
      {needCpf ? (
        <div className="space-y-3">
          <GlassInput label="CPF do responsável" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
          <button type="button" onClick={create} className="liquid-glass-selected rounded-full px-5 py-2.5 text-sm"><span className="relative z-10">Gerar Pix</span></button>
        </div>
      ) : null}
      {pix ? (
        <>
          <div className="liquid-glass rounded-[28px] p-4 text-center">
            <p className="relative z-10 text-xs text-white/70">Pague com Pix</p>
            <p className="relative z-10 mb-3 text-2xl font-medium">R$ {pix.value.toFixed(2).replace(".", ",")}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/png;base64,${pix.qr}`} alt="QR Code do Pix" className="relative z-10 mx-auto h-52 w-52 rounded-2xl bg-white p-2" />
          </div>
          <button type="button" onClick={copy} className="liquid-glass-selected flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm">
            <span className="relative z-10 flex items-center gap-2">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Código copiado!" : "Copiar código Pix (copia e cola)"}</span>
          </button>
          <p className="flex items-center justify-center gap-2 px-2 text-center text-xs text-white/70">
            <Loader2 size={14} className="animate-spin" /> Aguardando o pagamento. Assim que cair, o livro começa a ser criado sozinho.
          </p>
        </>
      ) : null}
    </div>
  );
}
