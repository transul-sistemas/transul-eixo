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
import {
  NOME_DO_COOKIE_DE_PLACAS,
  type PreferenciasDaTabela,
  serializarPreferencias,
} from "@/lib/navegacao/preferencias-da-tabela";

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

function gravarCookie(preferencias: PreferenciasDaTabela) {
  const umAno = 60 * 60 * 24 * 365;
  document.cookie = `${NOME_DO_COOKIE_DE_PLACAS}=${serializarPreferencias(preferencias)}; path=/; max-age=${umAno}; SameSite=Lax`;
}

export function ProvedorDaLista({
  preferenciasIniciais,
  children,
}: {
  preferenciasIniciais: PreferenciasDaTabela;
  children: ReactNode;
}) {
  const [pendente, comecar] = useTransition();
  const [preferencias, setPreferencias] = useState(preferenciasIniciais);
  const ultimas = useRef(preferenciasIniciais);

  const iniciar = useCallback((navegar: () => void) => comecar(navegar), []);
  const atualizarPreferencias = useCallback((parcial: Partial<PreferenciasDaTabela>) => {
    const novas = { ...ultimas.current, ...parcial };
    ultimas.current = novas;
    setPreferencias(novas);
    gravarCookie(novas);
  }, []);

  const valor = useMemo(
    () => ({ pendente, iniciar, preferencias, atualizarPreferencias }),
    [pendente, iniciar, preferencias, atualizarPreferencias],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
