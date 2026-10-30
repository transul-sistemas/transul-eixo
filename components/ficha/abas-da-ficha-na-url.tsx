"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import { ABAS_DA_FICHA, type AbaId, comAba, lerAba } from "@/lib/navegacao/ficha";
import { AbasDaFicha } from "./abas-da-ficha";

/**
 * As abas da ficha com a aba ativa na URL (`?aba=`). Trocar de aba usa `replaceState`: a ficha é
 * uma página só, então a troca não empilha histórico (o Voltar do navegador sai da ficha, não anda
 * entre abas), e recarregar ou compartilhar o link devolve a mesma aba. O resto da URL não muda.
 */
export function AbasDaFichaNaUrl({ conteudos }: { conteudos: Record<AbaId, ReactNode> }) {
  const caminho = usePathname();
  const parametros = useSearchParams();
  const daUrl = lerAba(new URLSearchParams(parametros.toString()));
  // A troca aparece na hora; a URL (replaceState) chega logo depois e volta a mandar se mudar por
  // fora (link, Voltar, outra aba na barra de endereço).
  const [escolhida, setEscolhida] = useState(daUrl);
  const [urlAnterior, setUrlAnterior] = useState(daUrl);
  if (daUrl !== urlAnterior) {
    setUrlAnterior(daUrl);
    setEscolhida(daUrl);
  }
  const ativa = escolhida;

  function mudar(aba: AbaId) {
    setEscolhida(aba);
    const texto = comAba(new URLSearchParams(parametros.toString()), aba).toString();
    window.history.replaceState(null, "", texto ? `${caminho}?${texto}` : caminho);
  }

  return <AbasDaFicha abas={ABAS_DA_FICHA} ativa={ativa} aoMudar={mudar} conteudos={conteudos} />;
}
