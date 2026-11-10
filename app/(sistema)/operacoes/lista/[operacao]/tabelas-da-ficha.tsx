"use client";

import Link from "next/link";
import { Etiqueta } from "@/components/etiqueta";
import { formatarMes } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro } from "@/components/formato/numero";
import { Placa } from "@/components/placa";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import { type ColunaDeTabela, TabelaDeDados } from "@/components/tabela/tabela-de-dados";
import type {
  FilialDoMapa,
  PontoMensal,
  PessoasDaOperacao,
  PessoasPorFuncao,
  PlacaDaOperacao,
  ValorPorNatureza,
} from "@/lib/dados/operacoes-tipos";
import { SIGLAS_DA_ESCALA } from "@/lib/dominio/esquemas/pessoa";
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
  {
    id: "olho",
    titulo: "Detalhes",
    classe: "w-14 text-right",
    celula: (l) => (
      <BotaoDoOlho
        item={l.placa}
        titulo={<Placa placa={l.placa} tamanho="g" />}
        hrefDaFicha={`/frota/placas/${l.placa}`}
        detalhes={[
          { rotulo: "Tipo", valor: NOMES_DOS_TIPOS[l.tipo] ?? l.tipo },
          { rotulo: "Modelo", valor: l.modelo ?? "—" },
          { rotulo: "Situação", valor: `${l.sigla} · ${l.nomeDaSituacao}` },
          { rotulo: "CR", valor: l.cr ?? "—" },
          { rotulo: "Gestor de frota", valor: l.gestor ?? "—" },
        ]}
      />
    ),
  },
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

const COLUNAS_DAS_FUNCOES: readonly ColunaDeTabela<PessoasPorFuncao>[] = [
  { id: "funcao", titulo: "Função", cabecalhoDeLinha: true, celula: (l) => l.nomeDaFuncao },
  {
    id: "pessoas",
    titulo: "Pessoas",
    classe: DIREITA,
    celula: (l) => formatarInteiro(l.pessoas),
  },
  ...SIGLAS_DA_ESCALA.map((s): ColunaDeTabela<PessoasPorFuncao> => ({
    id: `escala-${s.id}`,
    titulo: `${s.nome} (dias)`,
    classe: DIREITA,
    celula: (l) => formatarInteiro(l.escala[s.id] ?? 0),
  })),
  {
    id: "olho",
    titulo: "Detalhes",
    classe: "w-14 text-right",
    celula: (l) => (
      <BotaoDoOlho
        item={l.nomeDaFuncao}
        detalhes={[
          { rotulo: "Pessoas na função", valor: formatarInteiro(l.pessoas) },
          ...SIGLAS_DA_ESCALA.map((s) => ({
            rotulo: `${s.nome} no mês (dias)`,
            valor: formatarInteiro(l.escala[s.id] ?? 0),
          })),
          {
            rotulo: "Nomes",
            valor: l.nomes ? l.nomes.join(", ") : "Visíveis só para quem tem acesso a Pessoas",
          },
        ]}
      />
    ),
  },
];

/** As pessoas vinculadas hoje, por função, com a escala do mês. Nome só para quem vê Pessoas. */
export function TabelaDasFuncoes({ funcoes }: { funcoes: readonly PessoasPorFuncao[] }) {
  return (
    <TabelaDeDados
      rotulo="Pessoas por função e escala do mês"
      colunas={COLUNAS_DAS_FUNCOES}
      linhas={funcoes}
      idDaLinha={(l) => l.funcao}
      ordem={{ campo: "funcao", sentido: "asc" }}
      aoOrdenar={SEM_ORDEM}
    />
  );
}

const COLUNAS_DAS_FILIAIS: readonly ColunaDeTabela<FilialDoMapa>[] = [
  { id: "filial", titulo: "Filial", cabecalhoDeLinha: true, celula: (l) => l.filial },
  {
    id: "cidade",
    titulo: "Cidade/UF",
    celula: (l) => (l.cidade || l.uf ? [l.cidade, l.uf].filter(Boolean).join("/") : SEM_VALOR),
  },
  { id: "placas", titulo: "Placas", classe: DIREITA, celula: (l) => formatarInteiro(l.placas) },
  {
    id: "atividade",
    titulo: "Em atividade",
    classe: DIREITA,
    celula: (l) => formatarInteiro(l.emAtividade),
  },
  {
    id: "impedidas",
    titulo: "Impedidas",
    classe: DIREITA,
    celula: (l) => formatarInteiro(l.impedidas),
  },
  {
    id: "olho",
    titulo: "Detalhes",
    classe: "w-14 text-right",
    celula: (l) => (
      <BotaoDoOlho
        item={l.filial}
        detalhes={[
          {
            rotulo: "Cidade/UF",
            valor: l.cidade || l.uf ? [l.cidade, l.uf].filter(Boolean).join("/") : "—",
          },
          { rotulo: "Placas da operação", valor: formatarInteiro(l.placas) },
          { rotulo: "Em atividade", valor: formatarInteiro(l.emAtividade) },
          { rotulo: "Impedidas", valor: formatarInteiro(l.impedidas) },
        ]}
      />
    ),
  },
];

/** As placas da operação por filial (cidade/UF da garagem). Sem telemetria: não há posição ao vivo. */
export function TabelaDasFiliais({ filiais }: { filiais: readonly FilialDoMapa[] }) {
  return (
    <TabelaDeDados
      rotulo="Placas por filial"
      colunas={COLUNAS_DAS_FILIAIS}
      linhas={filiais}
      idDaLinha={(l) => l.filial}
      ordem={{ campo: "placas", sentido: "desc" }}
      aoOrdenar={SEM_ORDEM}
    />
  );
}

const COLUNAS_DOS_MESES: readonly ColunaDeTabela<PontoMensal>[] = [
  { id: "mes", titulo: "Mês", cabecalhoDeLinha: true, celula: (l) => formatarMes(l.mes) },
  {
    id: "receita",
    titulo: "Receita",
    classe: DIREITA,
    celula: (l) => <Moeda valor={l.receitaCentavos} />,
  },
  {
    id: "frota",
    titulo: "Custo da frota",
    classe: DIREITA,
    celula: (l) => <Moeda valor={l.custoFrotaCentavos} />,
  },
  {
    id: "servico",
    titulo: "Custo de serviço e pessoal",
    classe: DIREITA,
    celula: (l) => <Moeda valor={l.custoServicoCentavos} />,
  },
  {
    id: "margem",
    titulo: "Margem",
    classe: DIREITA,
    celula: (l) => <Moeda valor={l.margemCentavos} />,
  },
  {
    id: "olho",
    titulo: "Detalhes",
    classe: "w-14 text-right",
    celula: (l) => (
      <BotaoDoOlho
        item={formatarMes(l.mes)}
        detalhes={[
          { rotulo: "Receita", valor: <Moeda valor={l.receitaCentavos} /> },
          { rotulo: "Custo da frota", valor: <Moeda valor={l.custoFrotaCentavos} /> },
          { rotulo: "Custo de serviço e pessoal", valor: <Moeda valor={l.custoServicoCentavos} /> },
          { rotulo: "Margem", valor: <Moeda valor={l.margemCentavos} /> },
        ]}
      />
    ),
  },
];

/** A margem mês a mês: um mês por linha, do mais recente ao mais antigo. */
export function TabelaDosMeses({ meses }: { meses: readonly PontoMensal[] }) {
  return (
    <TabelaDeDados
      rotulo="Resultado mês a mês"
      colunas={COLUNAS_DOS_MESES}
      linhas={meses}
      idDaLinha={(l) => l.mes}
      ordem={{ campo: "mes", sentido: "desc" }}
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
