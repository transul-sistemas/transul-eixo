"use client";

import { IconSunMoon } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

// O texto do botão não depende do tema, para não gerar diferença entre servidor e navegador.
// No celular só o ícone aparece; o nome "Alternar tema" continua para quem usa leitor de tela.
export function AlternadorDeTema() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="outline"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="max-lg:h-10 max-sm:w-10 max-sm:px-0"
    >
      <IconSunMoon aria-hidden className="sm:hidden" />
      <span className="max-sm:sr-only">Alternar tema</span>
    </Button>
  );
}
