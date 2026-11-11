"use client";

import { IconDeviceDesktop } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { avisoDeDispositivo } from "@/lib/navegacao/dispositivos";

/**
 * No celular, avisa que a tela funciona melhor num computador quando o catálogo não a marca para
 * celular. Só avisa: a tela continua utilizável. Em tablet e computador não aparece.
 */
export function AvisoDeDispositivo({ rota }: { rota?: string }) {
  const caminho = usePathname();
  const aviso = avisoDeDispositivo(rota ?? caminho ?? "");
  if (!aviso) return null;
  return (
    <p
      role="note"
      data-testid="aviso-de-dispositivo"
      className="border-border bg-muted flex items-center gap-2 border-b px-4 py-2 text-sm md:hidden"
    >
      <IconDeviceDesktop aria-hidden className="text-muted-foreground size-4 shrink-0" />
      {aviso}
    </p>
  );
}
