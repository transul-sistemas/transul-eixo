"use client";

import Link from "next/link";
import { Etiqueta } from "@/components/etiqueta";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro } from "@/components/formato/numero";
import { Placa } from "@/components/placa";
import { type ColunaDeTabela, TabelaDeDados } from "@/components/tabela/tabela-de-dados";
import type {
  PessoasDaOperacao,
  PlacaDaOperacao,
  ValorPorNatureza,
} from "@/lib/dados/operacoes-tipos";
import { NOMES_DOS_TIPOS } from "@/lib/dados/placas-tipos";

// As tabelas das abas da ficha da operação (Placas, Pessoas e Resultado). São curtas e vêm prontas e
// ordenadas do banco: a ordem é fixa e o cabeçalho não reordena.

const SEM_VALOR = <span className="text-muted-foreground">—</span>;
const DIREITA = "text-right tabular-nums";
const SEM_ORDEM = () => {};

const COLUNAS_DAS_PLACAS: readonly ColunaDeTabela<PlacaDaOperacao>[] = [
  {
    id: "placa",
    titulo: "Placa",
    cabecalhoDeLinha: true,
    celula: (l, { densidade }) => (
      <Link
        href={`/frota/placas/${l.placa}`}
        aria-label={`Abrir a ficha da placa ${l.placa}`}
        className="focus-visible:ring-ring/50 inline-flex rounded outline-none focus-visible:ring-3"
      >
        <Placa placa={l.placa} tamanho={densidade === "compacta" ? "p" : "m"} />
      </Link>
    ),
  },
  { id: "tipo", titulo: "Tipo", celula: (l) => NOMES_DOS_TIPOS[l.tipo] ?? l.tipo },
  { id: "modelo", titulo: "Modelo", celula: (l) => l.modelo ?? SEM_VALOR },
  {
    id: "situacao",
    titulo: "Situação",
    celula: (l) => (
      <Etiqueta status={l.grupo} titulo={l.nomeDaSituacao}>
        <span className="font-semibold">{l.sigla}</span>
        <span>{l.nomeDaSituacao}</span>
      </Etiqueta>
    ),
  },
  { id: "cr", titulo: "CR", celula: (l) => l.cr ?? SEM_VALOR },
  { id: "gestor", titulo: "Gestor de frota", celula: (l) => l.gestor ?? SEM_VALOR },
];

export function TabelaDasPlacas({ placas }: { placas: readonly PlacaDaOperacao[] }) {
  return (
    <TabelaDeDados
      rotulo="Placas vinculadas agora"
      colunas={COLUNAS_DAS_PLACAS}
      linhas={placas}
      idDaLinha={(l) => l.ativoId}
      ordem={{ campo: "placa", sentido: "asc" }}
      aoOrdenar={SEM_ORDEM}
    />
  );
}

type Departamento = PessoasDaOperacao["porDepartamento"][number];

const COLUNAS_DAS_PESSOAS: readonly ColunaDeTabela<Departamento>[] = [
  {
    id: "departamento",
    titulo: "Departamento",
    cabecalhoDeLinha: true,
    celula: (l) => l.departamento,
  },
  {
    id: "funcionarios",
    titulo: "Funcionários",
    classe: DIREITA,
    celula: (l) => formatarInteiro(l.funcionarios),
  },
  {
    id: "salario",
    titulo: "Salário bruto",
    classe: DIREITA,
    celula: (l) => <Moeda valor={l.salarioBrutoCentavos} />,
  },
];

export function TabelaDasPessoas({ pessoas }: { pessoas: PessoasDaOperacao }) {
  return (
    <TabelaDeDados
      rotulo="Pessoas da folha por departamento"
      colunas={COLUNAS_DAS_PESSOAS}
      linhas={pessoas.porDepartamento}
      idDaLinha={(l) => l.departamento}
      ordem={{ campo: "salario", sentido: "desc" }}
      aoOrdenar={SEM_ORDEM}
    />
  );
}

const COLUNAS_DAS_NATUREZAS: readonly ColunaDeTabela<ValorPorNatureza>[] = [
  { id: "natureza", titulo: "Natureza", cabecalhoDeLinha: true, celula: (l) => l.natureza },
  {
    id: "valor",
    titulo: "Valor",
    classe: DIREITA,
    celula: (l) => <Moeda valor={l.valorCentavos} />,
  },
];

export function TabelaDasNaturezas({
  rotulo,
  naturezas,
}: {
  rotulo: string;
  naturezas: readonly ValorPorNatureza[];
}) {
  return (
    <TabelaDeDados
      rotulo={rotulo}
      colunas={COLUNAS_DAS_NATUREZAS}
      linhas={naturezas}
      idDaLinha={(l) => l.natureza}
      ordem={{ campo: "valor", sentido: "desc" }}
      aoOrdenar={SEM_ORDEM}
      densidade="compacta"
    />
  );
}
