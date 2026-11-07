// Capas ilustradas dos temas (arte original em CSS + emoji): usadas no hero e na demonstração.
export type Art = { id: string; title: string; from: string; to: string; glow: string; main: string; extras: string[] };

export const ARTS: Art[] = [
  { id: "safari", title: "Safari Encantado", from: "#f59e0b", to: "#7c2d12", glow: "#fde68a", main: "🦁", extras: ["🐘", "🦒", "🌅", "🌿"] },
  { id: "estrelas", title: "Aventura nas Estrelas", from: "#6366f1", to: "#0f0a3c", glow: "#a5f3fc", main: "🚀", extras: ["🪐", "⭐", "🌙", "✨"] },
  { id: "floresta", title: "Floresta Mágica", from: "#22c55e", to: "#052e16", glow: "#bef264", main: "🦊", extras: ["🍄", "🦉", "🌲", "✨"] },
  { id: "fadas", title: "Reino das Fadas", from: "#ec4899", to: "#3b0764", glow: "#fbcfe8", main: "🧚", extras: ["🦋", "🌸", "✨", "🏰"] },
  { id: "dino", title: "Vale dos Dinossauros", from: "#84cc16", to: "#365314", glow: "#fef08a", main: "🦕", extras: ["🌋", "🌴", "🥚", "☄️"] },
  { id: "ilha", title: "Ilha dos Mares", from: "#06b6d4", to: "#083344", glow: "#fef3c7", main: "⛵", extras: ["🏝️", "🐚", "🐢", "🌺"] },
  { id: "heroi", title: "Super-herói", from: "#ef4444", to: "#1e1b4b", glow: "#fde047", main: "🦸", extras: ["⚡", "🏙️", "💥", "⭐"] },
  { id: "princesa", title: "Reino das Princesas", from: "#a855f7", to: "#4a044e", glow: "#fde68a", main: "👑", extras: ["🏰", "🦄", "💎", "✨"] },
  { id: "mar", title: "Fundo do Mar", from: "#0ea5e9", to: "#172554", glow: "#a7f3d0", main: "🐙", extras: ["🐠", "🫧", "🐚", "🪸"] },
];

const POS = ["left-[10%] top-[14%]", "right-[10%] top-[18%]", "left-[14%] bottom-[22%]", "right-[12%] bottom-[24%]"];

export function ArtScene({ art, className = "", big = false }: { art: Art; className?: string; big?: boolean }) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ background: `radial-gradient(circle at 50% 38%, ${art.glow}55 0%, transparent 45%), linear-gradient(160deg, ${art.from}, ${art.to})` }}
    >
      {art.extras.map((e, i) => (
        <span key={i} className={`absolute ${POS[i]} select-none opacity-80`} style={{ fontSize: big ? 56 : 28, animation: `floaty ${4 + i}s ease-in-out ${i * 0.5}s infinite` }}>
          {e}
        </span>
      ))}
      <span className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 select-none drop-shadow-[0_10px_24px_rgba(0,0,0,.45)]" style={{ fontSize: big ? 150 : 76 }}>
        {art.main}
      </span>
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
    </div>
  );
}
