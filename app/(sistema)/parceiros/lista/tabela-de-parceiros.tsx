"use client";

import Link from "next/link";
import { Etiqueta } from "@/components/etiqueta";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro } from "@/components/formato/numero";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import { type ColunaDeTabela, TabelaDeDados } from "@/components/tabela/tabela-de-dados";
import type { LinhaDeParceiro } from "@/lib/dados/parceiros-tipos";
import { NOMES_DOS_TIPOS_DE_PARCEIRO } from "@/lib/dominio/esquemas/parceiros";
import { enderecoDaConciliacao, enderecoDaFichaDoParceiro } from "@/lib/navegacao/parceiros";

// A tabela de Parceiros: uma linha por parceiro (são poucos, sem página), com as placas vinculadas
// agora e os totais do mês prontos do banco. O nome abre a ficha; "Conciliar" abre a conciliação do
// parceiro no mesmo mês.

const SEM_VALOR = <span className="text-muted-foreground">—</span>;
const DIREITA = "text-right tabular-nums";
const LINK =
  "focus-visible:ring-ring/50 font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3";

function colunas(mes: string): ColunaDeTabela<LinhaDeParceiro>[] {
  return [
    {
      id: "nome",
      titulo: "Parceiro",
      cabecalhoDeLinha: true,
      celula: (l) => (
        <Link
          href={enderecoDaFichaDoParceiro(l.id, mes)}
          aria-label={`Abrir a ficha do parceiro ${l.nome}`}
          className={LINK}
        >
          {l.nome}
        </Link>
      ),
    },
    {
      id: "tipos",
      titulo: "Tipo",
      celula: (l) => (
        <span className="flex flex-wrap gap-1">
          {l.tipos.map((t) => (
            <Etiqueta key={t} modulo="parceiros">
              {NOMES_DOS_TIPOS_DE_PARCEIRO[t]}
            </Etiqueta>
          ))}
        </span>
      ),
    },
    { id: "documento", titulo: "CPF/CNPJ", celula: (l) => l.documentoMascarado ?? SEM_VALOR },
    {
      id: "codparc",
      titulo: "CODPARC",
      classe: DIREITA,
      celula: (l) => (l.codparc === null ? SEM_VALOR : String(l.codparc)),
    },
    {
      id: "agrupador",
      titulo: "Agrupador no Sankhya",
      celula: (l) =>
        l.agrupador ? `${l.agrupador.codigo} ${l.agrupador.nome ?? ""}`.trim() : SEM_VALOR,
    },
    {
      id: "placas",
      titulo: "Placas agora",
      classe: DIREITA,
      celula: (l) => formatarInteiro(l.placas),
    },
    {
      id: "despesa",
      titulo: "Despesa do mês",
      classe: DIREITA,
      celula: (l) => <Moeda valor={l.despesaCentavos} />,
    },
    {
      id: "receita",
      titulo: "Receita do mês",
      classe: DIREITA,
      celula: (l) => <Moeda valor={l.receitaCentavos} />,
    },
    {
      id: "locacao",
      titulo: "Locação mensal",
      classe: DIREITA,
      celula: (l) => <Moeda valor={l.locacaoMensalCentavos} />,
    },
    {
      id: "conciliar",
      titulo: "Conciliação",
      celula: (l) =>
        l.agrupador ? (
          <Link
            href={enderecoDaConciliacao({ mes, agrupador: l.agrupador.id, situacao: "todas" })}
            aria-label={`Conciliar o parceiro ${l.nome}`}
            className={LINK}
          >
            Conciliar
          </Link>
        ) : (
          SEM_VALOR
        ),
    },
    {
      id: "olho",
      titulo: "Detalhes",
      classe: "w-14 text-right",
      celula: (l) => (
        <BotaoDoOlho
          item={l.nome}
          hrefDaFicha={enderecoDaFichaDoParceiro(l.id, mes)}
          detalhes={[
            { rotulo: "Tipo", valor: l.tipos.map((t) => NOMES_DOS_TIPOS_DE_PARCEIRO[t]).join(", ") },
            { rotulo: "CPF/CNPJ", valor: l.documentoMascarado ?? "—" },
            { rotulo: "CODPARC", valor: l.codparc === null ? "—" : String(l.codparc) },
            { rotulo: "Placas agora", valor: formatarInteiro(l.placas) },
            { rotulo: "Despesa do mês", valor: <Moeda valor={l.despesaCentavos} /> },
            { rotulo: "Receita do mês", valor: <Moeda valor={l.receitaCentavos} /> },
            { rotulo: "Locação mensal", valor: <Moeda valor={l.locacaoMensalCentavos} /> },
          ]}
        />
      ),
    },
  ];
}

export function TabelaDeParceiros({
  linhas,
  mes,
}: {
  linhas: readonly LinhaDeParceiro[];
  mes: string;
}) {
  return (
    <TabelaDeDados
      rotulo="Parceiros do mês"
      colunas={colunas(mes)}
      linhas={linhas}
      idDaLinha={(l) => l.id}
      ordem={{ campo: "nome", sentido: "asc" }}
      aoOrdenar={() => undefined}
    />
  );
}
