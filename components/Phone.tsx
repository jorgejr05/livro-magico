import type { ReactNode } from "react";

const BG =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260704_143500_a76b8e64-2c69-4683-80e7-2bb060a921d6.png&w=1280&q=85";

export function Phone({ children, tint }: { children: ReactNode; tint?: { from: string; to: string } }) {
  return (
    <div className="phone">
      <div className="island" />
      {/* fundo em tela cheia, desfocado */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${BG}")`, filter: "blur(12px)", transform: "scale(1.1)" }}
      />
      <div className="absolute inset-0" style={{ background: "#8a9aaa", opacity: 0.3 }} />
      {tint ? (
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{ background: `linear-gradient(160deg, ${tint.from}cc, ${tint.to}e6)` }}
        />
      ) : null}
      <div className="relative z-10 h-full w-full text-white">{children}</div>
    </div>
  );
}
