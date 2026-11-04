"use client";

import { createContext, type ReactNode, useContext } from "react";

// O usuário da sessão para os componentes do navegador (fatia 3.9a): a chave dos rascunhos dos
// assistentes. Vem do servidor (a sessão lida do banco); nunca uma chave provisória.

const Contexto = createContext<string | null>(null);

export function ProvedorDoUsuario({ usuario, children }: { usuario: string; children: ReactNode }) {
  return <Contexto.Provider value={usuario}>{children}</Contexto.Provider>;
}

export function useUsuarioDaSessao(): string {
  const usuario = useContext(Contexto);
  if (usuario === null) throw new Error("useUsuarioDaSessao precisa do ProvedorDoUsuario acima.");
  return usuario;
}
