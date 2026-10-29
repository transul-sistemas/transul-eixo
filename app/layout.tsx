import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { ProvedorDeTema } from "@/components/tema/provedor-de-tema";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "TranSul Eixo",
  description: "Sistema de gestão para a TranSul",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={cn("h-full antialiased", "font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ProvedorDeTema>{children}</ProvedorDeTema>
      </body>
    </html>
  );
}
