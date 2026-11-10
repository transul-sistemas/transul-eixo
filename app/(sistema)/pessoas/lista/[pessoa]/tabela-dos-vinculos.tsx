"use client";

import Link from "next/link";
import { formatarData } from "@/components/formato/data";
import { type ColunaDeTabela, TabelaDeDados } from "@/components/tabela/tabela-de-dados";
import type { VinculoDaPessoa } from "@/lib/dados/pessoas-tipos";

// A aba Vínculos da ficha da pessoa: cada vínculo (operação × função) com a vigência [início, fim),
// o mais recente primeiro. Curta e ordenada pelo banco: o cabeçalho não reordena.

const SEM_ORDEM = () => {};

const COLUNAS: readonly ColunaDeTabela<VinculoDaPessoa>[] = [
  {
    id: "operacao",
    titulo: "Operação",
    cabecalhoDeLinha: true,
    celula: (v) => (
      <Link
        href={`/operacoes/lista/${v.operacaoId}`}
        className="focus-visible:ring-ring/50 underline-offset-4 outline-none hover:underline focus-visible:ring-3"
      >
        {v.operacao}
      </Link>
    ),
  },
  { id: "funcao", titulo: "Função", celula: (v) => v.funcaoNome },
  {
    id: "inicio",
    titulo: "Início",
    classe: "tabular-nums",
    celula: (v) => formatarData(v.inicio),
  },
  {
    id: "fim",
    titulo: "Fim",
    classe: "tabular-nums",
    celula: (v) => (v.fim ? formatarData(v.fim) : "em aberto"),
  },
  {
    id: "vigente",
    titulo: "Hoje",
    celula: (v) => (v.vigente ? "vigente" : <span className="text-muted-foreground">—</span>),
  },
];

export function TabelaDosVinculos({ vinculos }: { vinculos: readonly VinculoDaPessoa[] }) {
  return (
    <TabelaDeDados
      rotulo="Vínculos da pessoa"
      colunas={COLUNAS}
      linhas={vinculos}
      idDaLinha={(v) => v.id}
      ordem={{ campo: "inicio", sentido: "desc" }}
      aoOrdenar={SEM_ORDEM}
    />
  );
}
