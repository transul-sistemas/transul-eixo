"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

// O texto do botão não depende do tema, para não gerar diferença entre servidor e navegador.
export function AlternadorDeTema() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button variant="outline" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      Alternar tema
    </Button>
  );
}
