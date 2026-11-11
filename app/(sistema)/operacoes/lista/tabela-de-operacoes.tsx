"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro, formatarPercentual } from "@/components/formato/numero";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import { type ColunaDeTabela, TabelaDeDados } from "@/components/tabela/tabela-de-dados";
import { type LinhaDeOperacao, NOMES_DOS_TIPOS_DE_OPERACAO } from "@/lib/dados/operacoes-tipos";
import {
  CAMPOS_DAS_OPERACOES,
  enderecoDaFicha,
  lerMes,
  PADRAO_DAS_OPERACOES,
} from "@/lib/navegacao/operacoes";
import { lerTabela, mudarConsulta } from "@/lib/navegacao/tabela";

// A tabela de Operações: uma linha por operação, com a cascata do mês pronta do banco. A ordem é do
// banco (o cabeçalho troca a ordem na URL); o nome abre a ficha levando o mês.

const SEM_VALOR = <span className="text-muted-foreground">—</span>;
const DIREITA = "text-right tabular-nums";

function colunas(
  mes: string | null,
  veResultado: boolean,
  semDados: boolean,
): ColunaDeTabela<LinhaDeOperacao>[] {
  const dinheiro = (
    id: string,
    titulo: string,
    valor: (l: LinhaDeOperacao) => number | undefined,
    ordenavel = true,
  ): ColunaDeTabela<LinhaDeOperacao> => ({
    id,
    titulo,
    campoDeOrdem: ordenavel ? id : undefined,
    classe: DIREITA,
    celula: (l) => {
      const v = valor(l);
      return v === undefined || semDados ? SEM_VALOR : <Moeda valor={v} />;
    },
  });
  const base: ColunaDeTabela<LinhaDeOperacao>[] = [
    {
      id: "nome",
      titulo: "Operação",
      campoDeOrdem: "nome",
      cabecalhoDeLinha: true,
      celula: (l) => (
        <Link
          href={enderecoDaFicha(l.id, mes)}
          aria-label={`Abrir a ficha da operação ${l.nome}`}
          className="focus-visible:ring-ring/50 font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3"
        >
          {l.nome}
        </Link>
      ),
    },
    { id: "tipo", titulo: "Tipo", celula: (l) => NOMES_DOS_TIPOS_DE_OPERACAO[l.tipo] ?? l.tipo },
    { id: "filial", titulo: "Filial", celula: (l) => l.filial ?? SEM_VALOR },
    {
      id: "base",
      titulo: "Base",
      celula: (l) =>
        l.baseCidade || l.baseUf ? [l.baseCidade, l.baseUf].filter(Boolean).join("/") : SEM_VALOR,
    },
    {
      id: "crs",
      titulo: "CRs",
      campoDeOrdem: "crs",
      classe: DIREITA,
      celula: (l) => formatarInteiro(l.crs),
    },
    {
      id: "placas",
      titulo: "Placas agora",
      campoDeOrdem: "placas",
      classe: DIREITA,
      celula: (l) => formatarInteiro(l.placas),
    },
  ];
  const olho: ColunaDeTabela<LinhaDeOperacao> = {
    id: "olho",
    titulo: "Detalhes",
    classe: "w-14 text-right",
    celula: (l) => (
      <BotaoDoOlho
        item={l.nome}
        hrefDaFicha={enderecoDaFicha(l.id, mes)}
        detalhes={[
          { rotulo: "Tipo", valor: NOMES_DOS_TIPOS_DE_OPERACAO[l.tipo] ?? l.tipo },
          { rotulo: "Filial", valor: l.filial ?? "—" },
          { rotulo: "CRs", valor: formatarInteiro(l.crs) },
          { rotulo: "Placas agora", valor: formatarInteiro(l.placas) },
          ...(l.cascata && !semDados
            ? [
                { rotulo: "Receita", valor: <Moeda valor={l.cascata.receitaCentavos} /> },
                {
                  rotulo: "Receita de CT-e",
                  valor: <Moeda valor={l.cascata.receitaCteCentavos} />,
                },
                {
                  rotulo: "Receita de NFS-e",
                  valor: <Moeda valor={l.cascata.receitaNfseCentavos} />,
                },
                { rotulo: "Custo Frota", valor: <Moeda valor={l.cascata.custoFrotaCentavos} /> },
                {
                  rotulo: "Custo Serviço",
                  valor: <Moeda valor={l.cascata.custoServicoCentavos} />,
                },
                { rotulo: "Margem", valor: <Moeda valor={l.cascata.margemCentavos} /> },
              ]
            : []),
        ]}
      />
    ),
  };
  if (!veResultado) return [...base, olho];
  return [
    ...base,
    dinheiro("receita", "Receita", (l) => l.cascata?.receitaCentavos),
    // As duas linhas da receita (CT-e e NFS-e); o total é a coluna Receita.
    dinheiro("receita_cte", "Receita de CT-e", (l) => l.cascata?.receitaCteCentavos, false),
    dinheiro("receita_nfse", "Receita de NFS-e", (l) => l.cascata?.receitaNfseCentavos, false),
    dinheiro("custo_frota", "Custo Frota", (l) => l.cascata?.custoFrotaCentavos),
    dinheiro("custo_servico", "Custo Serviço", (l) => l.cascata?.custoServicoCentavos),
    dinheiro("margem", "Margem", (l) => l.cascata?.margemCentavos),
    {
      id: "margem_percentual",
      titulo: "Margem %",
      campoDeOrdem: "margem_percentual",
      classe: DIREITA,
      celula: (l) =>
        l.cascata?.margemPercentual == null || semDados
          ? SEM_VALOR
          : formatarPercentual(l.cascata.margemPercentual),
    },
    olho,
  ];
}

export function TabelaDeOperacoes({
  linhas,
  veResultado,
  semDados = false,
}: {
  linhas: readonly LinhaDeOperacao[];
  veResultado: boolean;
  /** Sem receita nem custo em nenhum mês: o dinheiro vira traço, nunca R$ 0,00. */
  semDados?: boolean;
}) {
  const rota = usePathname();
  const parametros = useSearchParams();
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const atuais = new URLSearchParams(parametros.toString());
  const consulta = lerTabela(atuais, PADRAO_DAS_OPERACOES, CAMPOS_DAS_OPERACOES);

  function ordenarPor(campo: string) {
    const atual = consulta.ordem;
    const sentido = atual.campo === campo && atual.sentido === "asc" ? "desc" : "asc";
    const novos = mudarConsulta(
      new URLSearchParams(parametros.toString()),
      { ordem: { campo, sentido } },
      PADRAO_DAS_OPERACOES,
      CAMPOS_DAS_OPERACOES,
    ).toString();
    iniciar(() => router.push(novos ? `${rota}?${novos}` : rota, { scroll: false }));
  }

  return (
    <TabelaDeDados
      rotulo="Operações do mês"
      colunas={colunas(lerMes(atuais), veResultado, semDados)}
      linhas={linhas}
      idDaLinha={(l) => l.id}
      ordem={consulta.ordem}
      aoOrdenar={ordenarPor}
      pendente={pendente}
    />
  );
}
