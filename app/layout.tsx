import type { Metadata } from "next";
import "./globals.css";
import { Barlow, Barlow_Semi_Condensed } from "next/font/google";
import { ProvedorDeTema } from "@/components/tema/provedor-de-tema";
import { cn } from "@/lib/utils";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

// Fonte das placas de veículo.
const barlowDasPlacas = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
      className={cn("h-full antialiased", "font-sans", barlow.variable, barlowDasPlacas.variable)}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ProvedorDeTema>{children}</ProvedorDeTema>
      </body>
    </html>
  );
}
