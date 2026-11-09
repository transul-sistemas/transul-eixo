"use client";

import { useMemo, useState } from "react";
import { Etiqueta } from "@/components/etiqueta";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { type ColunaDeTabela, TabelaDeDados } from "@/components/tabela/tabela-de-dados";
import { Button } from "@/components/ui/button";
import type { UsuarioDaLista } from "@/lib/dados/usuarios-tipos";
import { AssistenteDeAcesso } from "./assistente-de-acesso";

// A tabela de usuários com o botão "Mudar acesso" em cada linha (só para quem pode editar).

const ORDEM_FIXA = { campo: "nome", sentido: "asc" } as const;
const SEM_ORDEM = () => {};
const lista = (itens: string[]) => (itens.length === 0 ? "-" : itens.join(", "));

export function TabelaDeUsuarios({
  usuarios,
  perfis,
  podeEditar,
  quemUsa,
}: {
  usuarios: readonly UsuarioDaLista[];
  perfis: readonly { codigo: string; nome: string }[];
  podeEditar: boolean;
  /** Quem usa: a chave dos rascunhos. */
  quemUsa: string;
}) {
  const [aberto, setAberto] = useState<UsuarioDaLista | null>(null);
  const colunas = useMemo<readonly ColunaDeTabela<UsuarioDaLista>[]>(
    () => [
      { id: "nome", titulo: "Nome", cabecalhoDeLinha: true, celula: (u) => u.nome },
      { id: "perfil", titulo: "Perfil", celula: (u) => u.perfilNome },
      { id: "escopo", titulo: "Escopo", celula: (u) => lista(u.escopos) },
      { id: "filiais", titulo: "Filiais", celula: (u) => lista(u.filiais) },
      { id: "operacoes", titulo: "Operações", celula: (u) => lista(u.operacoes) },
      {
        id: "situacao",
        titulo: "Situação",
        celula: (u) =>
          u.ativo ? (
            <Etiqueta status="em-atividade">Ativo</Etiqueta>
          ) : (
            <Etiqueta status="fora">Inativo</Etiqueta>
          ),
      },
      ...(podeEditar
        ? [
            {
              id: "acoes",
              titulo: "Ações",
              classe: "text-right",
              celula: (u: UsuarioDaLista) => (
                <Button size="sm" variant="outline" onClick={() => setAberto(u)}>
                  Mudar acesso
                </Button>
              ),
            },
          ]
        : []),
    ],
    [podeEditar],
  );
  return (
    <ProvedorDoUsuario usuario={quemUsa}>
      <TabelaDeDados
        rotulo="Usuários"
        colunas={colunas}
        linhas={usuarios}
        idDaLinha={(u) => u.pessoaId}
        ordem={ORDEM_FIXA}
        aoOrdenar={SEM_ORDEM}
        densidade="confortavel"
      />
      {aberto ? (
        <AssistenteDeAcesso
          key={aberto.pessoaId}
          usuario={aberto}
          perfis={perfis}
          aoFechar={() => setAberto(null)}
        />
      ) : null}
    </ProvedorDoUsuario>
  );
}
