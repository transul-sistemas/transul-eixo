import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { ProvedorDeTema } from "@/components/tema/provedor-de-tema";
import { cn } from "@/lib/utils";

// O nome da família no CSS é o nome da variável (Barlow, BarlowSemiCondensed).
// Fontes hospedadas no repositório (app/fonts, licença OFL). O next/font/google baixa uma versão
// reduzida que pode vir sem algarismos tabulares, e a moeda precisa deles (docs/decisoes.md).
const Barlow = localFont({
  src: [
    { path: "./fonts/barlow-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/barlow-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/barlow-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/barlow-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

// Fonte das placas de veículo.
const BarlowSemiCondensed = localFont({
  src: [
    { path: "./fonts/barlow-semi-condensed-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/barlow-semi-condensed-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/barlow-semi-condensed-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-placa",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TranSul Eixo",
  description: "Sistema de gestão para a TranSul",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={cn(
        "h-full antialiased",
        "font-sans",
        Barlow.variable,
        BarlowSemiCondensed.variable,
      )}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ProvedorDeTema>{children}</ProvedorDeTema>
      </body>
    </html>
  );
}
