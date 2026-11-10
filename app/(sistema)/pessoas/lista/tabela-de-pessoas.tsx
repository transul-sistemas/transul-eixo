"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { formatarData } from "@/components/formato/data";
import { type ColunaDeTabela, TabelaDeDados } from "@/components/tabela/tabela-de-dados";
import { type LinhaDePessoa, NOMES_DAS_SITUACOES } from "@/lib/dados/pessoas-tipos";
import {
  CAMPOS_DAS_PESSOAS,
  enderecoDaFichaDaPessoa,
  PADRAO_DAS_PESSOAS,
} from "@/lib/navegacao/pessoas";
import { lerTabela, mudarConsulta } from "@/lib/navegacao/tabela";

// A tabela de Pessoas: uma linha por pessoa, a página que o banco entregou. A ordem é do banco (o
// cabeçalho troca a ordem na URL); o nome abre a ficha. O CPF só aparece mascarado.

const SEM_VALOR = <span className="text-muted-foreground">—</span>;

const COLUNAS: ColunaDeTabela<LinhaDePessoa>[] = [
  {
    id: "nome",
    titulo: "Pessoa",
    campoDeOrdem: "nome",
    cabecalhoDeLinha: true,
    celula: (l) => (
      <Link
        href={enderecoDaFichaDaPessoa(l.id)}
        aria-label={`Abrir a ficha de ${l.nome}`}
        className="focus-visible:ring-ring/50 font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3"
      >
        {l.nome}
      </Link>
    ),
  },
  {
    id: "cpf",
    titulo: "CPF",
    classe: "tabular-nums",
    celula: (l) => l.documentoMascarado ?? SEM_VALOR,
  },
  {
    id: "situacao",
    titulo: "Situação",
    celula: (l) => NOMES_DAS_SITUACOES[l.situacao] ?? l.situacao,
  },
  {
    id: "funcao",
    titulo: "Função",
    campoDeOrdem: "funcao",
    celula: (l) => l.funcaoNome ?? SEM_VALOR,
  },
  {
    id: "operacao",
    titulo: "Operação",
    campoDeOrdem: "operacao",
    celula: (l) => l.operacao ?? SEM_VALOR,
  },
  {
    id: "desde",
    titulo: "Desde",
    campoDeOrdem: "desde",
    classe: "tabular-nums",
    celula: (l) => (l.desde ? formatarData(l.desde) : SEM_VALOR),
  },
];

export function TabelaDePessoas({ linhas }: { linhas: readonly LinhaDePessoa[] }) {
  const rota = usePathname();
  const parametros = useSearchParams();
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const consulta = lerTabela(
    new URLSearchParams(parametros.toString()),
    PADRAO_DAS_PESSOAS,
    CAMPOS_DAS_PESSOAS,
  );

  function ordenarPor(campo: string) {
    const atual = consulta.ordem;
    const sentido = atual.campo === campo && atual.sentido === "asc" ? "desc" : "asc";
    const novos = mudarConsulta(
      new URLSearchParams(parametros.toString()),
      { ordem: { campo, sentido } },
      PADRAO_DAS_PESSOAS,
      CAMPOS_DAS_PESSOAS,
    ).toString();
    iniciar(() => router.push(novos ? `${rota}?${novos}` : rota, { scroll: false }));
  }

  return (
    <TabelaDeDados
      rotulo="Pessoas"
      colunas={COLUNAS}
      linhas={linhas}
      idDaLinha={(l) => l.id}
      ordem={consulta.ordem}
      aoOrdenar={ordenarPor}
      pendente={pendente}
    />
  );
}
