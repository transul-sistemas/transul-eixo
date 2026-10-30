"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { gaveta } from "@/lib/navegacao/gaveta";
import { useTelaGrande } from "./tela-grande";

/**
 * Tudo o que não é o menu: topo e conteúdo. Com a gaveta aberta em tela pequena fica inerte (sem
 * foco, sem clique, fora da leitura de tela), para o teclado não escapar para trás do menu.
 */
export function AreaPrincipal({ children }: { children: ReactNode }) {
  const aberta = useSyncExternalStore(gaveta.assinar, gaveta.estaAberta, () => false);
  const telaGrande = useTelaGrande();
  return (
    <div
      inert={aberta && !telaGrande ? true : undefined}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      {children}
    </div>
  );
}
