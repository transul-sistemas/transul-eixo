"use client";

import { IconSunMoon } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

// O texto do botão não depende do tema, para não gerar diferença entre servidor e navegador.
// Abaixo de 1536 px só o ícone aparece (o topo do 1366 já é apertado); o nome "Alternar tema"
// continua para o leitor de tela e vira tooltip (`title`).
export function AlternadorDeTema() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="outline"
      title="Alternar tema"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="max-2xl:w-9 max-2xl:px-0 max-lg:h-10 max-sm:w-10"
    >
      <IconSunMoon aria-hidden className="2xl:hidden" />
      <span className="max-2xl:sr-only">Alternar tema</span>
    </Button>
  );
}
