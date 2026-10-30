"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
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
}

const Contexto = createContext<ContextoDaLista | null>(null);

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
    () => ({ pendente, iniciar, preferencias, atualizarPreferencias }),
    [pendente, iniciar, preferencias, atualizarPreferencias],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
