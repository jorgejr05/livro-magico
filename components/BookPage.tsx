"use client";

import { Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Phone } from "./Phone";
import { PayPanel } from "./PayPanel";
import { Cinema } from "./Cinema";
import { GlassPill, delay } from "./ui";
import { getTheme } from "@/lib/themes";
import { getInfo, loadResult, needsWork, runPipeline, type BookInfo, type Progress } from "@/lib/bookClient";
import type { Answers, Result } from "@/lib/types";

type View = "loading" | "pay" | "making" | "ready" | "expired" | "error";

// Página de um livro: cobra o Pix se faltar, gera o que falta (retomável) e abre o player.
export function BookPage({ id }: { id: string }) {
  const headers = useMemo(() => ({ "Content-Type": "application/json" }), []);
  const [view, setView] = useState<View>("loading");
  const [info, setInfo] = useState<BookInfo | null>(null);
  const [data, setData] = useState<{ result: Result; info: BookInfo; answers: Answers } | null>(null);
  const [prog, setProg] = useState<Progress>({ story: false, images: 0, total: 1, narration: false, music: false });
  const [err, setErr] = useState("");
  const running = useRef(false);

  const open = useCallback(async () => {
    try {
      setData(await loadResult(id));
      setView("ready");
    } catch (e) {
      setErr((e as Error).message);
      setView("error");
    }
  }, [id]);

  const make = useCallback(async (b: BookInfo) => {
    if (running.current) return;
    running.current = true;
    setView("making");
    setErr("");
    try {
      await runPipeline(b, headers, setProg);
      await open();
    } catch (e) {
      setErr((e as Error).message);
      setView("error");
    }
    running.current = false;
  }, [headers, open]);

  const decide = useCallback(async () => {
    try {
      const b = await getInfo(id);
      setInfo(b);
      if (b.status === "expired") return setView("expired");
      if (b.status === "awaiting_payment") return setView("pay");
      if (needsWork(b) && (b.status === "paid" || b.status === "generating" || b.status === "failed")) return void make(b);
      await open();
    } catch (e) {
      setErr((e as Error).message);
      setView("error");
    }
  }, [id, make, open]);

  useEffect(() => { decide(); }, [decide]);

  if (view === "ready" && data) return <Cinema result={data.result} info={data.info} answers={data.answers} headers={headers} />;

  const theme = info?.theme_id ? getTheme(info.theme_id) : null;
  const items = [
    { ok: prog.story, label: "Roteiro e letra da música" },
    { ok: prog.images >= prog.total && prog.total > 0, label: `Imagens para celular e TV (${Math.min(prog.images, prog.total)}/${prog.total})` },
    { ok: prog.narration, label: "Narração da história" },
    { ok: prog.music, label: "Música de aniversário" },
  ];
  const title =
    view === "pay" ? "Falta só o pagamento" : view === "making" ? "A Luna está criando o seu livro" : view === "expired" ? "Este livro expirou" : view === "error" ? "Algo deu errado" : "Abrindo o seu livro";
  const sub = view === "pay" ? "Pix, rapidinho" : view === "making" ? "Pode fechar e voltar depois" : view === "expired" ? "Guardamos por 90 dias" : "Só um instante";

  return (
    <Phone tint={theme ? theme.colors : undefined}>
      <div className="flex h-full flex-col px-6 pb-6 pt-14">
        <div className="fade-up mb-6 flex items-center justify-between" style={delay(0.1)}>
          <GlassPill><span className="relative z-10 text-xs font-medium text-white/90">Livro Mágico</span></GlassPill>
          <a href="/meus-livros" className="text-xs text-white/70 underline">Meus livros</a>
        </div>
        <div className="fade-up mb-6" style={delay(0.25)}>
          <p className="mb-1.5 text-sm text-white/60">{sub}</p>
          <h1 className="text-[28px] font-normal leading-[1.1] tracking-tight text-white">{title}</h1>
          {info ? <p className="mt-2 text-sm text-white/70">Livro de {info.child_name}</p> : null}
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {view === "loading" ? <div className="flex justify-center pt-8"><Loader2 className="animate-spin text-white/70" /></div> : null}
          {view === "pay" ? <PayPanel id={id} headers={headers} onPaid={() => decide()} /> : null}
          {view === "making" ? (
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={it.label} className="liquid-glass fade-up flex items-center gap-3 rounded-[24px] px-4 py-3.5" style={delay(0.3 + i * 0.1)}>
                  <span className="relative z-10 flex h-6 w-6 items-center justify-center">
                    {it.ok ? <Check size={18} /> : <Loader2 size={18} className="animate-spin text-white/70" />}
                  </span>
                  <span className="relative z-10 text-sm">{it.label}</span>
                </div>
              ))}
              <p className="px-2 pt-2 text-xs text-white/60">Leva alguns minutos. Se a tela apagar ou fechar, é só voltar: seu livro continua de onde parou (Meus livros, com seu nome e WhatsApp).</p>
            </div>
          ) : null}
          {view === "expired" ? <p className="text-sm text-white/80">O prazo de 90 dias passou e os arquivos foram apagados. Você pode criar um novo livro.</p> : null}
          {view === "error" ? (
            <div className="space-y-3">
              <p className="rounded-2xl bg-red-500/30 p-3 text-xs">{err}</p>
              <button type="button" onClick={() => { running.current = false; setView("loading"); decide(); }} className="liquid-glass rounded-full px-5 py-2.5 text-sm"><span className="relative z-10">Tentar de novo</span></button>
            </div>
          ) : null}
        </div>
      </div>
    </Phone>
  );
}
