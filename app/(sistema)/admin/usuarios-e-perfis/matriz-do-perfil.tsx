"use client";

import { useMemo } from "react";
import { type ColunaDeTabela, TabelaDeDados } from "@/components/tabela/tabela-de-dados";
import type { MatrizDoPerfil } from "@/lib/dados/usuarios-tipos";

// A matriz de permissões de um perfil, só leitura: módulo nas linhas, ação nas colunas e, em cada
// célula, o escopo (Tudo, Minha carteira, Operação, Filial) ou um traço quando o perfil não pode.

type Linha = MatrizDoPerfil["linhas"][number];

const ORDEM_FIXA = { campo: "modulo", sentido: "asc" } as const;
const SEM_ORDEM = () => {};

export function MatrizDoPerfilNaTela({ matriz }: { matriz: MatrizDoPerfil }) {
  const colunas = useMemo<readonly ColunaDeTabela<Linha>[]>(
    () => [
      { id: "modulo", titulo: "Módulo", cabecalhoDeLinha: true, celula: (l) => l.modulo },
      ...matriz.acoes.map((a): ColunaDeTabela<Linha> => ({
        id: a.codigo,
        titulo: a.nome,
        celula: (l) => l.celulas[a.codigo] ?? <span className="text-muted-foreground">-</span>,
      })),
    ],
    [matriz.acoes],
  );
  return (
    <TabelaDeDados
      rotulo={`Permissões do perfil ${matriz.perfil.nome}`}
      colunas={colunas}
      linhas={matriz.linhas}
      idDaLinha={(l) => l.modulo}
      ordem={ORDEM_FIXA}
      aoOrdenar={SEM_ORDEM}
      densidade="compacta"
    />
  );
}
