"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { urlDaEntradaAnterior } from "@/components/navegacao/historico-do-navegador";
import { entradaAnteriorEhALista } from "@/lib/navegacao/espiar";

export const PARAMETRO_DO_ASSISTENTE = "assistente";
/** Campo preenchido pela ação da linha: `?assistente=<id>&pre.<campo>=<valor>`. */
export const PREFIXO_DO_PREENCHIDO = "pre.";

/**
 * O assistente aberto na URL (`?assistente=<id>`), com a mesma disciplina do painel de espiar:
 * abre na hora (otimista) e a URL confirma; abrir é um passo novo no histórico (o Voltar do
 * navegador fecha); fechar só usa o Voltar se a entrada anterior é a própria tela, senão tira o
 * parâmetro da URL (nunca sai do sistema, nem com o servidor lento); e fechar antes de a URL de
 * abrir chegar fecha assim que ela chegar.
 */
export function useAssistenteNaUrl(id: string) {
  const rota = usePathname();
  const parametros = useSearchParams();
  const router = useRouter();
  const daUrl = parametros.get(PARAMETRO_DO_ASSISTENTE) === id;
  const [, navegar] = useTransition();
  const [otimista, definirOtimista] = useOptimistic<boolean, boolean>(
    daUrl,
    (_atual, nova) => nova,
  );
  // Fechou antes de a abertura chegar à URL: fica fechado até a URL chegar e ser fechada de verdade.
  const [cancelada, setCancelada] = useState(false);
  const aberto = cancelada && daUrl ? false : otimista;
  const abertoPelaTela = useRef(false);
  const fecharAoChegar = useRef(false);
  const daUrlAnterior = useRef(daUrl);

  const enderecoCom = useCallback(
    (aberta: boolean) => {
      const novos = new URLSearchParams(parametros.toString());
      if (aberta) novos.set(PARAMETRO_DO_ASSISTENTE, id);
      else {
        novos.delete(PARAMETRO_DO_ASSISTENTE);
        // Os valores que a ação da linha preencheu (`pre.<campo>`) saem junto com o assistente.
        for (const chave of [...novos.keys()]) {
          if (chave.startsWith(PREFIXO_DO_PREENCHIDO)) novos.delete(chave);
        }
      }
      const texto = novos.toString();
      return texto ? `${rota}?${texto}` : rota;
    },
    [id, parametros, rota],
  );

  /** Volta no histórico se a entrada anterior é a própria tela; senão tira o parâmetro da URL. */
  const fecharDeVerdade = useCallback(() => {
    const podeVoltar =
      abertoPelaTela.current &&
      entradaAnteriorEhALista(
        urlDaEntradaAnterior(),
        { origem: window.location.origin, caminho: rota },
        [PARAMETRO_DO_ASSISTENTE],
      );
    abertoPelaTela.current = false;
    if (podeVoltar) router.back();
    else router.replace(enderecoCom(false), { scroll: false });
  }, [enderecoCom, rota, router]);

  const abrir = useCallback(() => {
    fecharAoChegar.current = false;
    setCancelada(false);
    navegar(() => {
      definirOtimista(true);
      abertoPelaTela.current = true;
      router.push(enderecoCom(true), { scroll: false });
    });
  }, [definirOtimista, enderecoCom, navegar, router]);

  const fechar = useCallback(() => {
    navegar(() => {
      definirOtimista(false);
      if (!daUrl) {
        fecharAoChegar.current = true;
        setCancelada(true);
        return;
      }
      fecharDeVerdade();
    });
  }, [daUrl, definirOtimista, fecharDeVerdade, navegar]);

  // A URL perdeu o parâmetro (Voltar do navegador): o assistente já não foi aberto pela tela.
  useEffect(() => {
    if (!daUrl && daUrlAnterior.current) abertoPelaTela.current = false;
    daUrlAnterior.current = daUrl;
  }, [daUrl]);

  // Fechou antes de a abertura chegar à URL: assim que chegar, fecha de verdade.
  useEffect(() => {
    if (daUrl && fecharAoChegar.current) {
      fecharAoChegar.current = false;
      navegar(() => {
        definirOtimista(false);
        fecharDeVerdade();
      });
      setTimeout(() => setCancelada(false), 0);
    }
  }, [daUrl, definirOtimista, fecharDeVerdade, navegar]);

  return { aberto, abrir, fechar };
}
