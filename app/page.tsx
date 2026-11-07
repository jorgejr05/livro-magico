import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Landing } from "@/components/landing/Landing";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-landing" });

export const metadata: Metadata = {
  title: "Livro Mágico | A aventura de aniversário do seu filho",
  description:
    "Um livro ilustrado com o seu filho como herói, história narrada com emoção, música de aniversário exclusiva e um vídeo para guardar para sempre.",
};

export default function Home() {
  return (
    <div className={`${font.variable} landing`}>
      <Landing />
    </div>
  );
}
