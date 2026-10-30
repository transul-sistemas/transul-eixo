"use client";

import { useEffect, useSyncExternalStore } from "react";
import { criarLojaDeHidratacao } from "@/lib/navegacao/hidratacao";

/**
 * As regiões que hidratam por conta própria e têm de estar prontas antes de o painel de espiar
 * abrir por link direto: o topo e a barra de consulta (cada um em seu Suspense) e a lista.
 */
const loja = criarLojaDeHidratacao(["topo", "consulta", "lista"]);

/** Avisa, no efeito (que só roda depois de a região hidratar), que a região está pronta. */
export function useMarcarHidratacao(regiao: "topo" | "consulta" | "lista") {
  useEffect(() => loja.marcar(regiao), [regiao]);
}

/** Todas as regiões já hidratam? No servidor e durante a hidratação, não. */
export function useHidratacaoPronta(): boolean {
  return useSyncExternalStore(loja.assinar, loja.pronta, loja.prontaNoServidor);
}

/** Para as regiões que são só servidor: põe dentro do Suspense, e ele avisa quando hidratar. */
export function SinalDeHidratacao({ regiao }: { regiao: "topo" | "consulta" | "lista" }) {
  useMarcarHidratacao(regiao);
  return null;
}
