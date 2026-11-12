"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Camera, Check, ChevronDown, Film, Heart, Images, Mic, Music, ShieldCheck, Sparkles, Tv, Wand2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ARTS, ArtScene } from "./art";
import { TunnelHero } from "./TunnelHero";

// Preços ainda não definidos: mantenha false até decidir os valores reais.
const SHOW_PRICING = false;

const CTA = "group inline-flex items-center gap-3 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-7 py-3.5 text-sm font-bold text-amber-950 shadow-[0_10px_40px_-10px_rgba(251,191,36,.7)] transition hover:scale-[1.03] sm:text-base";

const fade = { initial: { opacity: 0, y: 28 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.6, ease: "easeOut" as const } };

function Section({ id, kicker, title, children }: { id?: string; kicker: string; title: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <motion.div {...fade} className="mx-auto mb-12 max-w-2xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">{kicker}</p>
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">{title}</h2>
      </motion.div>
      {children}
    </section>
  );
}

/* ---------- navegação ---------- */
function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav className="flex w-full max-w-5xl items-center justify-between rounded-full border border-white/10 bg-[#0b0a1a]/70 px-5 py-2.5 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2 text-sm font-extrabold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-pink-400 text-amber-950"><BookOpen size={16} /></span>
          Livro Mágico
        </Link>
        <div className="hidden items-center gap-7 text-sm text-white/70 md:flex">
          <a href="#como-funciona" className="hover:text-white">Como funciona</a>
          <a href="#exemplo" className="hover:text-white">Exemplo</a>
          {SHOW_PRICING ? <a href="#planos" className="hover:text-white">Planos</a> : null}
          <a href="#duvidas" className="hover:text-white">Dúvidas</a>
          <Link href="/meus-livros" className="hover:text-white">Meus livros</Link>
        </div>
        <Link href="/criar" className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0b0a1a] transition hover:bg-amber-200 sm:text-sm">Criar meu livro</Link>
      </nav>
    </header>
  );
}

/* ---------- como funciona ---------- */
const STEPS = [
  { icon: Camera, title: "Conte e envie", text: "Nome, idade, o que ele(a) ama e até 10 fotos. Você paga por Pix e acompanha tudo pelo WhatsApp que informar." },
  { icon: Wand2, title: "A Luna escreve", text: "Nossa roteirista cria uma história só dele(a), com a sua família dentro." },
  { icon: Images, title: "Imagens mágicas", text: "Seu filho vira o protagonista de ilustrações no tema que escolher." },
  { icon: Mic, title: "Voz e música", text: "Narração cheia de emoção e uma música de parabéns exclusiva." },
];

function Steps() {
  return (
    <Section id="como-funciona" kicker="Como funciona" title={<>Do formulário ao <span className="text-amber-300">“uau”</span> em minutos</>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <motion.div key={s.title} {...fade} transition={{ ...fade.transition, delay: i * 0.08 }} className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6">
            <span className="absolute right-4 top-3 text-6xl font-black text-white/[0.06]">{i + 1}</span>
            <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-900/50"><s.icon size={22} /></span>
            <h3 className="text-lg font-bold text-white">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{s.text}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* ---------- demonstração ---------- */
const DEMO = [
  { art: ARTS[0], text: "Era uma vez uma savana dourada, onde a pequena Sofia chegou dançando!" },
  { art: ARTS[1], text: "E de repente, um foguete brilhante levou a Sofia até as estrelas..." },
  { art: ARTS[3], text: "Feliz aniversário, Sofia! Que a sua vida seja cheia de amor e magia!" },
];

function Demo() {
  const [scene, setScene] = useState(0);
  const [shown, setShown] = useState(0);
  const words = DEMO[scene].text.split(" ");
  useEffect(() => {
    const id = setInterval(() => {
      setShown((n) => {
        if (n < words.length + 4) return n + 1;
        setScene((s) => (s + 1) % DEMO.length);
        return 0;
      });
    }, 380);
    return () => clearInterval(id);
  }, [words.length]);
  return (
    <Section id="exemplo" kicker="Veja como fica" title={<>Imagem em tela cheia, voz e legenda <span className="text-amber-300">no ritmo da história</span></>}>
      <motion.div {...fade} className="relative mx-auto max-w-4xl">
        <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-r from-indigo-600/30 via-fuchsia-500/20 to-amber-400/30 blur-3xl" />
        <div className="relative aspect-video overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl shadow-black/60">
          <div className="absolute inset-0 flex justify-center">
            <div className="h-full aspect-square">
              <ArtScene art={DEMO[scene].art} big key={scene} className="animate-[fadeIn_.8s_ease_both]" />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-6 pb-5 pt-16 text-center">
            <p className="mx-auto max-w-2xl text-base font-bold leading-snug text-white drop-shadow sm:text-2xl">
              {words.map((w, i) => (
                <span key={i} className={i < shown ? (i === shown - 1 ? "text-amber-200" : "text-white") : "opacity-0"}>{w} </span>
              ))}
            </p>
          </div>
          <span className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">Exemplo ilustrativo</span>
        </div>
        <p className="mt-5 text-center text-sm text-white/50">Perfeito para assistir em família, na TV ou no telão da festa.</p>
      </motion.div>
    </Section>
  );
}

/* ---------- recursos ---------- */
function Features() {
  const items = [
    { icon: Images, title: "Ilustrações com o seu filho", text: "Até 10 imagens no tema que vocês escolherem: safári, espaço, princesas, super-heróis, o que ele(a) ama.", big: true },
    { icon: Mic, title: "Narração com emoção", text: "Uma voz calorosa conta a história como quem conta no colo, com votos de felicidade." },
    { icon: Music, title: "Música de parabéns exclusiva", text: "Letra com o nome dele(a), refrão para cantar junto." },
    { icon: Film, title: "Vídeo para guardar", text: "Tudo reunido em um MP4 que salva direto na galeria e vai para o WhatsApp.", big: true },
    { icon: Tv, title: "Pronto para a TV", text: "Tela cheia, sem cortes, em qualquer tamanho de tela." },
    { icon: Heart, title: "Sem fricção", text: "Sem login, sem app. Funciona no celular." },
  ];
  return (
    <Section kicker="O que você recebe" title={<>Uma memória completa, <span className="text-amber-300">não só um livro</span></>}>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((f, i) => (
          <motion.div key={f.title} {...fade} transition={{ ...fade.transition, delay: i * 0.06 }} className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-7 transition hover:border-amber-300/40 ${f.big ? "md:col-span-2" : ""}`}>
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl transition group-hover:bg-amber-400/25" />
            <f.icon className="relative mb-4 text-amber-300" size={26} />
            <h3 className="relative text-xl font-bold text-white">{f.title}</h3>
            <p className="relative mt-2 max-w-md text-sm leading-relaxed text-white/60">{f.text}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* ---------- segurança ---------- */
function Trust() {
  const t = [
    ["Só com autorização", "Pedimos o consentimento do responsável antes de usar qualquer foto."],
    ["Fotos temporárias", "Os arquivos de trabalho são apagados automaticamente em até 1 dia."],
    ["Personagens originais", "Criamos heróis e cenários originais, sem marcas ou personagens de terceiros."],
  ];
  return (
    <section className="mx-auto max-w-6xl px-5">
      <motion.div {...fade} className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-3">
        {t.map(([h, p]) => (
          <div key={h} className="bg-[#0b0a1a] p-7">
            <ShieldCheck className="mb-3 text-emerald-300" size={24} />
            <h3 className="font-bold text-white">{h}</h3>
            <p className="mt-1.5 text-sm text-white/60">{p}</p>
          </div>
        ))}
      </motion.div>
    </section>
  );
}

/* ---------- planos ---------- */
const PLANS = [
  { name: "Livro Mágico", price: "49,90", desc: "História personalizada com ilustrações incríveis.", items: ["História com o nome do seu filho", "Até 10 imagens no tema escolhido", "Livro interativo em tela cheia"], hot: false },
  { name: "Memória Encantada", price: "89,90", desc: "Livro + narração + música personalizada.", items: ["Tudo do Livro Mágico", "Narração com emoção e legenda", "Música de parabéns exclusiva"], hot: true },
  { name: "Edição de Colecionador", price: "129,90", desc: "A experiência completa, para guardar para sempre.", items: ["Tudo da Memória Encantada", "Vídeo MP4 completo para a galeria", "Imagens separadas para salvar e imprimir"], hot: false },
];

function Pricing() {
  return (
    <Section id="planos" kicker="Planos" title={<>Escolha como guardar essa <span className="text-amber-300">memória</span></>}>
      <div className="grid items-stretch gap-5 md:grid-cols-3">
        {PLANS.map((p, i) => (
          <motion.div key={p.name} {...fade} transition={{ ...fade.transition, delay: i * 0.08 }} className={`relative flex flex-col rounded-3xl p-7 ${p.hot ? "border-2 border-amber-300 bg-gradient-to-b from-indigo-900/70 to-[#0b0a1a] shadow-[0_0_60px_-10px_rgba(251,191,36,.4)] md:-my-4 md:py-11" : "border border-white/10 bg-white/[0.04]"}`}>
            {p.hot ? <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-amber-950">Mais escolhido</span> : null}
            <h3 className="text-xl font-extrabold text-white">{p.name}</h3>
            <p className="mt-1 text-sm text-white/60">{p.desc}</p>
            <p className="mt-6 text-white"><span className="text-sm text-white/60">R$ </span><span className="text-5xl font-extrabold tracking-tight">{p.price}</span></p>
            <ul className="my-6 flex-1 space-y-3 text-sm text-white/80">
              {p.items.map((it) => (
                <li key={it} className="flex gap-2.5"><Check size={16} className="mt-0.5 shrink-0 text-emerald-300" />{it}</li>
              ))}
            </ul>
            <Link href="/criar" className={`rounded-full px-5 py-3 text-center text-sm font-bold transition hover:scale-[1.02] ${p.hot ? "bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950" : "bg-white/10 text-white hover:bg-white/20"}`}>Quero este</Link>
          </motion.div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-white/40">Valores de lançamento, sujeitos a ajuste. Na fase de testes, a criação é liberada sem cobrança.</p>
    </Section>
  );
}

/* ---------- dúvidas ---------- */
const FAQ = [
  ["Quais fotos devo enviar?", "Fotos de frente, bem iluminadas e com a criança vestida (de preferência com ombros e pernas cobertos). Você pode enviar até 10. Fotos com pouca roupa podem ser recusadas pelo gerador de imagens."],
  ["Posso pedir personagens famosos?", "Você descreve do que seu filho gosta e criamos heróis, princesas e cenários originais com o mesmo clima. Não usamos nomes, logos ou personagens de terceiros."],
  ["Minhas fotos ficam guardadas?", "As fotos são enviadas a provedores de IA apenas para gerar as imagens do livro, e só com o seu consentimento. Os arquivos temporários do vídeo são apagados automaticamente em até 1 dia. Baixe o que quiser guardar."],
  ["Quanto tempo leva?", "Em poucos minutos o livro fica pronto. O vídeo em MP4 leva um pouco mais para ser montado."],
  ["Dá para ver na TV?", "Sim. O livro abre em tela cheia sem cortar a imagem, e o vídeo salvo pode ser transmitido para a TV ou projetado no telão da festa."],
  ["Como salvo no celular?", "Há um botão para salvar as imagens e o vídeo direto na galeria, em um toque, pelo menu do próprio celular."],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="duvidas" kicker="Dúvidas" title="Perguntas frequentes">
      <div className="mx-auto max-w-3xl space-y-3">
        {FAQ.map(([q, a], i) => (
          <motion.div key={q} {...fade} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold text-white">
              {q}
              <ChevronDown size={18} className={`shrink-0 text-amber-300 transition-transform ${open === i ? "rotate-180" : ""}`} />
            </button>
            <div className={`grid transition-all duration-300 ${open === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden"><p className="px-6 pb-5 text-sm leading-relaxed text-white/65">{a}</p></div>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* ---------- chamada final e rodapé ---------- */
function Final() {
  return (
    <section className="mx-auto max-w-5xl px-5 pb-20">
      <motion.div {...fade} className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-600 px-6 py-16 text-center">
        <Sparkles className="absolute left-8 top-8 text-amber-200/70" />
        <Sparkles className="absolute bottom-8 right-10 text-amber-200/70" />
        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">Faça esse aniversário virar uma história.</h2>
        <p className="mx-auto mt-4 max-w-md text-white/80">Em poucos minutos você tem um presente que a família inteira vai querer rever.</p>
        <Link href="/criar" className={`${CTA} mt-8`}>Criar meu livro agora <ArrowRight size={18} className="transition group-hover:translate-x-1" /></Link>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 px-5 py-10 text-center text-xs leading-relaxed text-white/40">
      <p className="font-semibold text-white/70">Livro Mágico</p>
      <p className="mx-auto mt-2 max-w-xl">Histórias, imagens e músicas geradas com inteligência artificial a partir das informações enviadas pelos responsáveis. Livro Mágico não é afiliado a marcas, estúdios ou personagens de terceiros.</p>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-[#07060f] text-white antialiased">
      <Nav />
      <TunnelHero />
      <Steps />
      <Demo />
      <Features />
      <Trust />
      {SHOW_PRICING ? <Pricing /> : null}
      <Faq />
      <Final />
      <Footer />
    </div>
  );
}
