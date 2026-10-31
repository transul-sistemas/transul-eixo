"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { comEspiar, entradaAnteriorEhALista, lerEspiar } from "@/lib/navegacao/espiar";
import { montarCookie, type PreferenciasDaTabela } from "@/lib/navegacao/preferencias-da-tabela";

// Estado compartilhado de uma lista na tela: se uma nova página, filtro ou ordem está a caminho
// (a tabela fica esmaecida e chips, páginas e cabeçalhos não aceitam novo clique) e as preferências
// da pessoa (densidade, tamanho, colunas), que vão para o cookie.

interface ContextoDaLista {
  /** Uma navegação da lista está em andamento. */
  pendente: boolean;
  /** Executa a navegação dentro da transição compartilhada. */
  iniciar: (navegar: () => void) => void;
  preferencias: PreferenciasDaTabela;
  /** Atualiza as preferências na tela e no cookie, sem navegar. */
  atualizarPreferencias: (parcial: Partial<PreferenciasDaTabela>) => void;
  /** A placa do painel de espiar: abre na hora (otimista) e acompanha `?espiar=` na URL. */
  placaEspiada: string | null;
  /** Abre o painel de uma placa: um passo novo no histórico (o Voltar do navegador fecha). */
  espiar: (placa: string) => void;
  /** Troca a placa do painel já aberto, sem passo novo no histórico. */
  trocarPlaca: (placa: string) => void;
  /** Fecha o painel: desfaz o passo de abrir (se foi aberto pela lista) ou tira `?espiar=`. */
  fecharPainel: () => void;
}

const Contexto = createContext<ContextoDaLista | null>(null);

/**
 * A URL da entrada anterior do histórico (Navigation API). Sem a API, `undefined`: não há como
 * saber e o painel fecha sem voltar (tirando `?espiar=` da URL), o caminho que nunca sai do sistema.
 */
function urlDaEntradaAnterior(): string | null | undefined {
  type Entrada = { url: string | null };
  const navegacao = (
    window as unknown as {
      navigation?: { currentEntry: { index: number } | null; entries(): Entrada[] };
    }
  ).navigation;
  if (!navegacao?.currentEntry) return undefined;
  return navegacao.entries()[navegacao.currentEntry.index - 1]?.url ?? null;
}

/** Quem usa fora de uma lista (a página de demonstração) recebe `null` e segue sem transição. */
export function useLista(): ContextoDaLista | null {
  return useContext(Contexto);
}

export function ProvedorDaLista({
  preferenciasIniciais,
  nomeDoCookie,
  children,
}: {
  preferenciasIniciais: PreferenciasDaTabela;
  /** Cada lista tem o seu cookie, para uma não sobrescrever as preferências da outra. */
  nomeDoCookie: string;
  children: ReactNode;
}) {
  const [pendente, comecar] = useTransition();
  const [preferencias, setPreferencias] = useState(preferenciasIniciais);
  const ultimas = useRef(preferenciasIniciais);

  const iniciar = useCallback((navegar: () => void) => comecar(navegar), []);

  // ---- painel de espiar (a URL manda; o clique abre na hora e a URL confirma)
  const rota = usePathname();
  const parametros = useSearchParams();
  const router = useRouter();
  const [, navegarPainel] = useTransition();
  const daUrl = lerEspiar(new URLSearchParams(parametros.toString()));
  const [otimista, definirOtimista] = useOptimistic<string | null, string | null>(
    daUrl,
    (_atual, nova) => nova,
  );
  // Fechou antes de a abertura chegar à URL: a placa cancelada fica fechada (sem piscar aberta)
  // até a URL chegar e o painel ser fechado de verdade.
  const [cancelada, setCancelada] = useState<string | null>(null);
  const placaEspiada = cancelada !== null && daUrl === cancelada ? null : otimista;
  // O painel foi aberto por um clique desta lista (e não por link direto)? Então fechar é voltar.
  const abertoPelaLista = useRef(false);
  // Fechou antes de a abertura chegar à URL: assim que chegar, fecha de novo.
  const fecharAoChegar = useRef(false);

  const enderecoCom = useCallback(
    (placa: string | null) => {
      const texto = comEspiar(new URLSearchParams(parametros.toString()), placa).toString();
      return texto ? `${rota}?${texto}` : rota;
    },
    [parametros, rota],
  );
  // `espiar` e `trocarPlaca` não podem mudar de identidade quando a URL chega: a tabela refaz as
  // colunas e remonta as células (o botão perde o foco e a rolagem lateral volta ao início).
  const endereco = useRef(enderecoCom);
  useEffect(() => {
    endereco.current = enderecoCom;
  }, [enderecoCom]);

  // A placa que está na URL agora, para `espiar` (que não muda de identidade) saber se o clique
  // é na própria placa do link direto: aí o `push` vira `replaceState` e não nasce entrada.
  const urlAtual = useRef(daUrl);
  useEffect(() => {
    urlAtual.current = daUrl;
  }, [daUrl]);

  const espiar = useCallback(
    (placa: string) => {
      fecharAoChegar.current = false;
      setCancelada(null);
      navegarPainel(() => {
        definirOtimista(placa);
        if (placa !== urlAtual.current) abertoPelaLista.current = true;
        router.push(endereco.current(placa), { scroll: false });
      });
    },
    [router, definirOtimista],
  );

  const trocarPlaca = useCallback(
    (placa: string) => {
      navegarPainel(() => {
        definirOtimista(placa);
        router.replace(endereco.current(placa), { scroll: false });
      });
    },
    [router, definirOtimista],
  );

  const fecharPainel = useCallback(() => {
    navegarPainel(() => {
      definirOtimista(null);
      if (daUrl === null) {
        fecharAoChegar.current = true;
        setCancelada(otimista);
        return;
      }
      if (
        abertoPelaLista.current &&
        entradaAnteriorEhALista(urlDaEntradaAnterior(), {
          origem: window.location.origin,
          caminho: rota,
        })
      ) {
        abertoPelaLista.current = false;
        router.back();
      } else {
        abertoPelaLista.current = false;
        router.replace(enderecoCom(null), { scroll: false });
      }
    });
  }, [daUrl, otimista, enderecoCom, router, definirOtimista, rota]);

  // Só zera "aberto pela lista" quando a URL de fato saiu de "com placa" para "sem placa". Zerar a
  // cada execução apagava a marca logo depois do clique (a URL ainda era nula) e o fechar virava
  // `replace` em vez de Voltar.
  const daUrlAnterior = useRef(daUrl);
  useEffect(() => {
    if (daUrl === null && daUrlAnterior.current !== null) abertoPelaLista.current = false;
    daUrlAnterior.current = daUrl;
  }, [daUrl]);

  useEffect(() => {
    if (daUrl !== null && fecharAoChegar.current) {
      fecharAoChegar.current = false;
      fecharPainel();
      // O fechamento já roda numa transição (fica fechado até a URL voltar); solta a placa cancelada.
      setTimeout(() => setCancelada(null), 0);
    }
  }, [daUrl, fecharPainel]);

  // Outra navegação da lista (chip, busca, ordem) substitui a abertura que ficou esperando: some a
  // pendência, para uma placa cancelada não fechar sozinha um painel aberto mais tarde.
  const chaveDaLista = comEspiar(new URLSearchParams(parametros.toString()), null).toString();
  const chaveAnterior = useRef(chaveDaLista);
  useEffect(() => {
    if (chaveAnterior.current === chaveDaLista) return;
    chaveAnterior.current = chaveDaLista;
    fecharAoChegar.current = false;
    setTimeout(() => setCancelada(null), 0);
  }, [chaveDaLista]);
  const atualizarPreferencias = useCallback(
    (parcial: Partial<PreferenciasDaTabela>) => {
      const novas = { ...ultimas.current, ...parcial };
      ultimas.current = novas;
      setPreferencias(novas);
      document.cookie = montarCookie(novas, nomeDoCookie, window.location.protocol);
    },
    [nomeDoCookie],
  );

  const valor = useMemo(
    () => ({
      pendente,
      iniciar,
      preferencias,
      atualizarPreferencias,
      placaEspiada,
      espiar,
      trocarPlaca,
      fecharPainel,
    }),
    [
      pendente,
      iniciar,
      preferencias,
      atualizarPreferencias,
      placaEspiada,
      espiar,
      trocarPlaca,
      fecharPainel,
    ],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
