"use client";

import { ArrowLeft, Check, Loader2, Minus, Plus, Timer, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Phone } from "./Phone";
import { Cinema } from "./Cinema";
import { OtherField } from "./OtherField";
import { GlassInput, GlassPill, GlassTextarea, SelectionGrid, SlideToConfirm, VoiceButton, delay } from "./ui";
import { fileToResizedDataUrl } from "@/lib/image";
import { CATEGORIES, LOVES, THEMES, TRAITS, getTheme } from "@/lib/themes";
import { EMPTY_ANSWERS, type Answers, type Photo, type Result, type Story } from "@/lib/types";

type StepId =
  | "code"
  | "child"
  | "family"
  | "theme"
  | "loves"
  | "traits"
  | "memory"
  | "luna"
  | "photos"
  | "generating"
  | "result";

const FLOW: StepId[] = ["child", "family", "theme", "loves", "traits", "memory", "luna", "photos", "generating", "result"];
const MAX_PHOTOS = 10;
const FALLBACK_QUESTION = "Qual é o apelido carinhoso ou a brincadeira favorita dela?";

type Progress = { story: boolean; images: number; narration: boolean; music: boolean };

// Consumo real que o servidor devolve em cada chamada (cabeçalho x-usage).
function readUsage(r: Response): unknown {
  try {
    const h = r.headers.get("x-usage");
    return h ? JSON.parse(h) : undefined;
  } catch {
    return undefined;
  }
}

export function Wizard() {
  const [accessRequired, setAccessRequired] = useState<boolean | null>(null);
  const [access, setAccess] = useState("");
  const [step, setStep] = useState<StepId>("child");
  const [a, setA] = useState<Answers>(EMPTY_ANSWERS);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [msg, setMsg] = useState("");
  const [cat, setCat] = useState("");
  const [like, setLike] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>({ story: false, images: 0, narration: false, music: false });
  const [result, setResult] = useState<Result | null>(null);
  const [fatal, setFatal] = useState("");
  const started = useRef(false);
  const followupUsage = useRef<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((p) => ({ ...p, [k]: v }));
  const toggle = (k: "loves" | "traits", id: string) =>
    setA((p) => ({ ...p, [k]: p[k].includes(id) ? p[k].filter((x) => x !== id) : [...p[k], id] }));

  const addCustom = (k: "loves" | "traits", v: string) => {
    const t = v.trim().slice(0, 40);
    if (t.length < 2) return;
    setA((p) => (p[k].some((x) => x.toLowerCase() === t.toLowerCase()) ? p : { ...p, [k]: [...p[k], t] }));
  };

  const theme = useMemo(() => (a.themeId ? getTheme(a.themeId) : null), [a.themeId]);

  const headers = useCallback(
    (): Record<string, string> => ({ "Content-Type": "application/json", "x-access-code": access }),
    [access],
  );

  // A tela de código só aparece se o servidor tiver ACCESS_CODE configurado.
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setAccessRequired(Boolean(d.accessRequired));
        if (d.accessRequired) setStep("code");
      })
      .catch(() => setAccessRequired(false));
  }, []);

  /* ---------- navegação ---------- */
  const order = useMemo(() => (accessRequired ? (["code", ...FLOW] as StepId[]) : FLOW), [accessRequired]);
  const idx = order.indexOf(step);
  const go = (s: StepId) => {
    setMsg("");
    setStep(s);
  };
  const next = () => go(order[Math.min(order.length - 1, idx + 1)]);
  const back = () => go(order[Math.max(0, idx - 1)]);

  /* ---------- validação por etapa ---------- */
  const validity: Record<StepId, string> = {
    code: access.trim() ? "" : "Digite o código de acesso.",
    child: a.childName.trim().length >= 2 ? "" : "Conte o nome da criança.",
    family: a.parents.trim().length >= 2 ? "" : "Diga quem está presenteando.",
    theme: a.themeId && (a.themeId !== "custom" || a.customTheme.trim().length >= 3) ? "" : "Escolha um tema ou descreva o seu.",
    loves: a.loves.length ? "" : "Escolha pelo menos uma opção.",
    traits: a.traits.length ? "" : "Escolha pelo menos uma opção.",
    memory: "",
    luna: "",
    photos: !photos.length ? "Envie ao menos uma foto." : !a.consent ? "Marque o consentimento dos responsáveis." : "",
    generating: "",
    result: "",
  };
  const blocked = () => setMsg(validity[step]);
  const canGo = !validity[step];

  /* ---------- etapa 'code' ---------- */
  const confirmCode = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: access }) });
      const d = await r.json();
      if (d.ok) next();
      else setMsg("Código incorreto.");
    } catch {
      setMsg("Não consegui conferir o código.");
    }
    setBusy(false);
  };

  /* ---------- Luna faz uma pergunta personalizada ---------- */
  const askLuna = async () => {
    setBusy(true);
    go("luna");
    try {
      const r = await fetch("/api/luna/followup", { method: "POST", headers: headers(), body: JSON.stringify({ answers: a }) });
      followupUsage.current = readUsage(r);
      const d = await r.json();
      set("lunaQuestion", r.ok && d.pergunta ? d.pergunta : FALLBACK_QUESTION);
    } catch {
      set("lunaQuestion", FALLBACK_QUESTION);
    }
    setBusy(false);
  };

  /* ---------- upload de fotos ---------- */
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).slice(0, room);
    const added: Photo[] = [];
    for (const f of picked) {
      try {
        added.push({ id: crypto.randomUUID(), name: f.name, dataUrl: await fileToResizedDataUrl(f) });
      } catch {
        setMsg("Alguma foto não pôde ser lida. Use JPG ou PNG.");
      }
    }
    setPhotos((p) => [...p, ...added]);
  };

  /* ---------- geração completa ---------- */
  const generate = useCallback(async () => {
    const usages: Record<string, unknown> = {};
    const eleven = async () => {
      try {
        const r = await fetch("/api/usage/eleven", { headers: headers(), cache: "no-store" });
        return r.ok ? await r.json() : null;
      } catch {
        return null;
      }
    };
    const elevenBefore = await eleven();
    const errors: string[] = [];
    const t0 = Date.now();
    const events: { step: string; ok: boolean; ms: number; error?: string; usage?: unknown }[] = [];
    const ev = (step: string, ok: boolean, since: number, error?: string) =>
      events.push({ step, ok, ms: Date.now() - since, error, usage: usages[step] });
    let orderId: string | null = null;
    try {
      const r = await fetch("/api/orders/start", { method: "POST", headers: headers(), body: JSON.stringify({ answers: a, photoCount: photos.length }) });
      if (r.ok) orderId = (await r.json()).id ?? null;
    } catch {}
    const finish = async (status: string, story: Story | null) => {
      if (!orderId) return;
      const elevenAfter = await eleven();
      if (followupUsage.current) events.push({ step: "followup", ok: true, ms: 0, usage: followupUsage.current });
      try {
        await fetch("/api/orders/finish", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ id: orderId, status, story, errors, events, totalMs: Date.now() - t0, usage: { eleven_before: elevenBefore, eleven_after: elevenAfter } }),
        });
      } catch {}
    };
    const post = async (url: string, body: unknown, step?: string) => {
      const r = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body) });
      if (step) usages[step] = readUsage(r);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || `Erro ${r.status}`);
      }
      return r;
    };

    try {
      const tStory = Date.now();
      const sr = await post("/api/luna/story", { answers: a, photoCount: photos.length }, "story");
      const { story } = (await sr.json()) as { story: Story };
      ev("story", true, tStory);
      setProgress((p) => ({ ...p, story: true }));

      const images: (string | null)[] = new Array(photos.length).fill(null);

      const imageJob = async () => {
        let cursor = 0;
        const worker = async () => {
          while (cursor < photos.length) {
            const i = cursor++;
            const tImg = Date.now();
            try {
              const r = await post("/api/generate/image", {
                photo: photos[i].dataUrl,
                scene: story.cenas[i],
                themeId: a.themeId,
                customTheme: a.customTheme,
                consent: a.consent,
              }, `image_${i + 1}`);
              images[i] = (await r.json()).image as string;
              ev(`image_${i + 1}`, true, tImg);
            } catch (e) {
              errors.push(`Imagem ${i + 1}: ${(e as Error).message}`);
              ev(`image_${i + 1}`, false, tImg, (e as Error).message);
            }
            setProgress((p) => ({ ...p, images: p.images + 1 }));
          }
        };
        await Promise.all([worker(), worker()]); // 2 imagens por vez
      };

      let narrTimes: Result["narrTimes"] = null;
      let lyricStarts: number[] | null = null;
      const b64ToUrl = (b64: string) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
      };

      const narrationJob = async () => {
        const t = Date.now();
        try {
          const r = await post("/api/generate/narration", { pages: story.paginas.map((p) => p.fala || p.texto) }, "narration");
          const j = await r.json();
          narrTimes = j.pages;
          const out = b64ToUrl(j.audio);
          ev("narration", true, t);
          setProgress((p) => ({ ...p, narration: true }));
          return out;
        } catch (e) {
          errors.push(`Narração: ${(e as Error).message}`);
          ev("narration", false, t, (e as Error).message);
          setProgress((p) => ({ ...p, narration: true }));
          return null;
        }
      };

      const musicJob = async () => {
        const t = Date.now();
        try {
          const r = await post("/api/generate/music", { letra: story.letra, estilo: story.estilo_musical }, "music");
          const blob = await r.blob();
          const out = URL.createObjectURL(blob);
          // Tempo real dos versos: se falhar, o livro usa a estimativa.
          try {
            const fd = new FormData();
            fd.append("audio", blob, "musica.mp3");
            fd.append("letra", JSON.stringify(story.letra));
            const sr = await fetch("/api/generate/lyrics-sync", { method: "POST", body: fd, headers: { "x-access-code": access } });
            if (sr.ok) {
              usages["lyrics_sync"] = readUsage(sr);
              ev("lyrics_sync", true, t);
              lyricStarts = (await sr.json()).starts;
            }
          } catch {
            /* segue com a estimativa */
          }
          ev("music", true, t);
          setProgress((p) => ({ ...p, music: true }));
          return out;
        } catch (e) {
          errors.push(`Música: ${(e as Error).message}`);
          ev("music", false, t, (e as Error).message);
          setProgress((p) => ({ ...p, music: true }));
          return null;
        }
      };

      const [narrationUrl, musicUrl] = await Promise.all([narrationJob(), musicJob(), imageJob()]);

      setResult({ story, images, narrationUrl, musicUrl, narrTimes, lyricStarts, errors, photoProblem: images.some((x) => !x) });
      await finish(errors.length ? "partial" : "done", story);
      go("result");
    } catch (e) {
      ev("story", false, t0, (e as Error).message);
      errors.push((e as Error).message);
      await finish("failed", null);
      setFatal((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, photos, headers]);

  useEffect(() => {
    if (step === "generating" && !started.current) {
      started.current = true;
      generate();
    }
  }, [step, generate]);

  const restart = () => {
    started.current = false;
    setA(EMPTY_ANSWERS);
    setPhotos([]);
    setResult(null);
    setFatal("");
    setProgress({ story: false, images: 0, narration: false, music: false });
    go(accessRequired ? "child" : "child");
  };

  /* ---------- cabeçalhos por etapa ---------- */
  const heads: Record<StepId, { sub: string; title: string }> = {
    code: { sub: "Acesso de teste", title: "Digite o código para entrar" },
    child: { sub: "Vamos começar", title: "Quem é a estrela desta história?" },
    family: { sub: "Com carinho de", title: "Quem vai assinar esta história?" },
    theme: { sub: "Escolha um", title: "Qual aventura vai inspirar o livro?" },
    loves: { sub: "Escolha todos que se aplicam", title: "O que a criança mais ama?" },
    traits: { sub: "Escolha todos que se aplicam", title: "Como é a personalidade da criança?" },
    memory: { sub: "Opcional", title: "Uma memória ou frase que só vocês conhecem?" },
    luna: { sub: "Uma pergunta da Luna", title: busy ? "A Luna está pensando..." : a.lunaQuestion },
    photos: { sub: `Até ${MAX_PHOTOS} fotos`, title: "Envie as fotos para virar aventura" },
    generating: { sub: "Aguarde um pouquinho", title: "A Luna está criando o seu livro" },
    result: { sub: "Pronto!", title: a.childName ? `O livro de ${a.childName}` : "Seu livro" },
  };

  const showSlider = !["generating", "result"].includes(step);
  const sliderAction = () => {
    if (!canGo) return blocked();
    if (step === "code") return void confirmCode();
    if (step === "memory") return void askLuna();
    if (step === "photos") {
      go("generating");
      return;
    }
    next();
  };
  const sliderLabel = step === "photos" ? "Criar o livro" : step === "code" ? "Entrar" : "Continuar";

  /* ---------- corpo de cada etapa ---------- */
  const body = (() => {
    switch (step) {
      case "code":
        return <GlassInput type="password" placeholder="Código de acesso" value={access} onChange={(e) => setAccess(e.target.value)} />;
      case "child":
        return (
          <div className="space-y-4">
            <div className="fade-up" style={delay(0.4)}>
              <GlassInput label="Nome" placeholder="Ex.: Antonella" value={a.childName} maxLength={40} onChange={(e) => set("childName", e.target.value)} />
            </div>
            <div className="fade-up" style={delay(0.48)}>
              <span className="mb-1.5 block px-2 text-xs text-white/60">Idade que completa</span>
              <div className="liquid-glass flex items-center justify-between rounded-[24px] px-3 py-2">
                <button type="button" aria-label="Menos" onClick={() => set("age", Math.max(1, a.age - 1))} className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Minus size={16} />
                </button>
                <span className="relative z-10 text-lg font-medium">{a.age} {a.age === 1 ? "aninho" : "aninhos"}</span>
                <button type="button" aria-label="Mais" onClick={() => set("age", Math.min(12, a.age + 1))} className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <div className="fade-up" style={delay(0.56)}>
              <GlassInput label="Data de nascimento (opcional)" type="date" value={a.birth} onChange={(e) => set("birth", e.target.value)} />
            </div>
          </div>
        );
      case "family":
        return (
          <div className="fade-up" style={delay(0.4)}>
            <GlassInput label="Quem presenteia" placeholder="Ex.: mamãe Rafaela e papai Jorge" value={a.parents} maxLength={80} onChange={(e) => set("parents", e.target.value)} />
          </div>
        );
      case "theme":
        return (
          <div className="space-y-3 pb-2">
            <SelectionGrid
              items={[...THEMES.map((t) => ({ id: t.id, label: t.label, hint: t.hint }))]}
              selected={a.themeId && a.themeId !== "custom" ? [a.themeId] : []}
              onToggle={(id) => { setCat(""); setLike(""); setA((p) => ({ ...p, themeId: id, customTheme: "" })); }}
            />
            <div className="fade-up" style={delay(0.9)}>
              <span className="mb-1.5 block px-2 text-xs text-white/60">Ou monte o seu tema</span>
              <div className="mb-3 flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const on = cat === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        const nc = on ? "" : c;
                        setCat(nc);
                        const t = [nc, like].filter(Boolean).join(": ");
                        setA((p) => ({ ...p, customTheme: t, themeId: t ? "custom" : "" }));
                      }}
                      className={`rounded-full px-3.5 py-2 text-[13px] text-white ${on ? "liquid-glass-selected" : "liquid-glass"}`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              <GlassInput
                placeholder="Do que ela(e) gosta? Ex.: heróis que voam, fundo do mar, fazendinha"
                value={like}
                maxLength={120}
                onChange={(e) => {
                  setLike(e.target.value);
                  const t = [cat, e.target.value.trim()].filter(Boolean).join(": ");
                  setA((p) => ({ ...p, customTheme: t, themeId: t ? "custom" : "" }));
                }}
              />
            </div>
          </div>
        );
      case "loves":
        return (
          <div className="space-y-3 pb-2">
            <SelectionGrid items={[...LOVES, ...a.loves.filter((x) => !LOVES.includes(x))].map((l) => ({ id: l, label: l }))} selected={a.loves} onToggle={(id) => toggle("loves", id)} />
            <OtherField placeholder="Outro? Digite e toque em adicionar" onAdd={(v) => addCustom("loves", v)} />
          </div>
        );
      case "traits":
        return (
          <div className="space-y-3 pb-2">
            <SelectionGrid items={[...TRAITS, ...a.traits.filter((x) => !TRAITS.includes(x))].map((l) => ({ id: l, label: l }))} selected={a.traits} onToggle={(id) => toggle("traits", id)} />
            <OtherField placeholder="Outro? Digite e toque em adicionar" onAdd={(v) => addCustom("traits", v)} />
          </div>
        );
      case "memory":
        return (
          <div className="fade-up" style={delay(0.4)}>
            <GlassTextarea
              placeholder="Escreva ou use o botão de voz. Ex.: ela chama o cachorro de 'Totó' e dança toda vez que ouve música."
              value={a.memory}
              maxLength={400}
              onChange={(e) => set("memory", e.target.value)}
            />
          </div>
        );
      case "luna":
        return busy ? (
          <div className="flex justify-center pt-6"><Loader2 className="animate-spin text-white/70" /></div>
        ) : (
          <div className="fade-up" style={delay(0.4)}>
            <GlassTextarea placeholder="Sua resposta (pode pular)" value={a.lunaAnswer} maxLength={300} onChange={(e) => set("lunaAnswer", e.target.value)} />
          </div>
        );
      case "photos":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label="Remover foto"
                    onClick={() => setPhotos((x) => x.filter((y) => y.id !== p.id))}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="liquid-glass fade-up flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl text-[11px] text-white/70"
                  style={delay(0.4)}
                >
                  <Upload size={18} className="relative z-10" />
                  <span className="relative z-10">{photos.length}/{MAX_PHOTOS}</span>
                </button>
              ) : null}
            </div>
            <p className="fade-up px-1 text-[11px] leading-snug text-white/60" style={delay(0.5)}>
              Dica: use fotos de frente, bem iluminadas e com a criança vestida (de preferência com ombros e pernas cobertos). Fotos com pouca roupa podem ser recusadas pelo gerador de imagens.
            </p>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
            <label className="fade-up flex cursor-pointer items-start gap-3 rounded-[24px] p-1 text-[12px] leading-snug text-white/80" style={delay(0.6)}>
              <input type="checkbox" className="peer sr-only" checked={a.consent} onChange={(e) => set("consent", e.target.checked)} />
              <span className="liquid-glass mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg peer-checked:bg-white/30 peer-focus-visible:ring-2 peer-focus-visible:ring-white">
                {a.consent ? <Check size={14} className="relative z-10" /> : null}
              </span>
              <span>
                Sou responsável legal pela criança e autorizo o uso destas fotos para criar o livro, a música e os vídeos. As fotos não são usadas para treinar modelos nem para divulgação.
              </span>
            </label>
          </div>
        );
      case "generating":
        return (
          <div className="space-y-3">
            {[
              { ok: progress.story, label: "Roteiro e letra da música" },
              { ok: progress.images >= photos.length && photos.length > 0, label: `Imagens do tema (${Math.min(progress.images, photos.length)}/${photos.length})` },
              { ok: progress.narration, label: "Narração da história" },
              { ok: progress.music, label: "Música de aniversário" },
            ].map((it, i) => (
              <div key={it.label} className="liquid-glass fade-up flex items-center gap-3 rounded-[24px] px-4 py-3.5" style={delay(0.3 + i * 0.1)}>
                <span className="relative z-10 flex h-6 w-6 items-center justify-center">
                  {it.ok ? <Check size={18} /> : <Loader2 size={18} className="animate-spin text-white/70" />}
                </span>
                <span className="relative z-10 text-sm">{it.label}</span>
              </div>
            ))}
            <p className="px-2 pt-2 text-xs text-white/60">Pode levar alguns minutos. Mantenha esta tela aberta.</p>
            {fatal ? (
              <div className="space-y-3">
                <p className="rounded-2xl bg-red-500/30 p-3 text-xs">{fatal}</p>
                <button type="button" onClick={() => { started.current = false; setFatal(""); setProgress({ story: false, images: 0, narration: false, music: false }); generate(); }} className="liquid-glass rounded-full px-5 py-2.5 text-sm">
                  Tentar de novo
                </button>
              </div>
            ) : null}
          </div>
        );
      case "result":
        return result ? <Cinema result={result} answers={a} onRestart={restart} headers={headers()} /> : null;
    }
  })();

  const fullBody = step === "result";

  return (
    <Phone tint={theme ? theme.colors : undefined}>
      <div className="flex h-full flex-col px-6 pb-6 pt-14">
        {/* cabeçalho */}
        <div className="fade-up mb-6 flex items-center justify-between" style={delay(0.1)}>
          <GlassPill>
            <Timer size={12} className="relative z-10 text-white/80" />
            <span className="relative z-10 text-xs font-medium text-white/90">Livro Mágico</span>
          </GlassPill>
          {idx > 0 && showSlider ? (
            <button type="button" onClick={back} aria-label="Voltar" className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full">
              <ArrowLeft size={16} className="relative z-10" />
            </button>
          ) : null}
        </div>

        {/* título */}
        {!fullBody ? (
          <div key={`h-${step}`} className="fade-up mb-6" style={delay(0.25)}>
            <p className="mb-1.5 text-sm text-white/60">{heads[step].sub}</p>
            <h1 className="text-[28px] font-normal leading-[1.1] tracking-tight text-white">{heads[step].title}</h1>
          </div>
        ) : null}

        {/* corpo */}
        <div key={`b-${step}`} className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {body}
        </div>

        {step === "memory" ? <VoiceButton onText={(t) => set("memory", (a.memory ? a.memory + " " : "") + t)} /> : null}
        {step === "luna" && !busy ? <div className="h-4" /> : null}

        {msg ? <p className="mb-2 mt-3 text-center text-xs text-white/80">{msg}</p> : null}

        {showSlider ? (
          <div key={`s-${step}`} className="mt-3">
            <SlideToConfirm label={busy ? "Aguarde..." : sliderLabel} canConfirm={canGo && !busy} onConfirm={sliderAction} onBlocked={blocked} />
          </div>
        ) : null}
      </div>
    </Phone>
  );
}
