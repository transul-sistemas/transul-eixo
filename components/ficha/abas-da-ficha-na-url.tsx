"use client";

import { type ReactNode, useEffect, useState } from "react";
import { ABAS_DA_FICHA, type AbaId, abaDoEndereco, comAba } from "@/lib/navegacao/ficha";
import { AbasDaFicha } from "./abas-da-ficha";

/**
 * As abas da ficha com a aba ativa na URL (`?aba=`). A aba inicial vem do servidor, lida dos
 * `searchParams` da página (valor inválido já chegou como Resumo), então o HTML traz a aba certa
 * sem depender do navegador. Trocar de aba usa `replaceState`: a ficha é uma página só, a troca não
 * empilha histórico (o Voltar do navegador sai da ficha), e recarregar ou compartilhar o link
 * devolve a mesma aba. O que muda por fora (Voltar e Avançar, outro `?aba=` por link) é lido do
 * endereço de verdade. O resto da URL não muda.
 */
export function AbasDaFichaNaUrl({
  abaInicial,
  conteudos,
}: {
  abaInicial: AbaId;
  conteudos: Record<AbaId, ReactNode>;
}) {
  const [ativa, setAtiva] = useState(abaInicial);
  const [inicialAnterior, setInicialAnterior] = useState(abaInicial);
  // O servidor entregou outra aba (navegação interna para outro `?aba=`): ela manda.
  if (abaInicial !== inicialAnterior) {
    setInicialAnterior(abaInicial);
    setAtiva(abaInicial);
  }

  // Voltar e Avançar mudam o endereço sem recarregar: a aba é a do endereço.
  useEffect(() => {
    const caminhoDaFicha = window.location.pathname;
    function aoMudarOEndereco() {
      const aba = abaDoEndereco(caminhoDaFicha, window.location.pathname, window.location.search);
      if (aba) setAtiva(aba);
    }
    window.addEventListener("popstate", aoMudarOEndereco);
    return () => window.removeEventListener("popstate", aoMudarOEndereco);
  }, []);

  function mudar(aba: AbaId) {
    setAtiva(aba);
    const texto = comAba(new URLSearchParams(window.location.search), aba).toString();
    window.history.replaceState(null, "", `${window.location.pathname}${texto ? `?${texto}` : ""}`);
  }

  return <AbasDaFicha abas={ABAS_DA_FICHA} ativa={ativa} aoMudar={mudar} conteudos={conteudos} />;
}
