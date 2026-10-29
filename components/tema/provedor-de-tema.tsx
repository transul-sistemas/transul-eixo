"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

// Segue o tema do sistema na primeira visita e lembra a escolha da pessoa.
export function ProvedorDeTema({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
