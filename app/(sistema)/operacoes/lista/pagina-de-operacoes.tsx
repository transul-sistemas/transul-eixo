import Link from "next/link";
import { connection } from "next/server";
import { formatarMes } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro, formatarPercentual } from "@/components/formato/numero";
import {
  BarraDeConsultaDaPagina,
  type ChipDeConsulta,
} from "@/components/layout/barra-de-consulta";
import { FaixaDeKpis, type Kpi } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerOperacoesDoMes, type OperacoesDoMes } from "@/lib/dados/operacoes";
import { acharTela } from "@/lib/navegacao/catalogo";
import {
  CHIPS_DE_FILIAL,
  CHIPS_DE_TIPO,
  enderecoDoMes,
  lerOperacoes,
  ROTA_DAS_OPERACOES,
} from "@/lib/navegacao/operacoes";
import { cn } from "@/lib/utils";
import { TabelaDeOperacoes } from "./tabela-de-operacoes";

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

// Operações › lista (primeira versão): cada operação com filial, CRs, placas vinculadas agora e a
// cascata do mês (receita, custo da Frota, custo de Serviço e margem), prontas no banco. Os números
// vêm do staging provisório (a cópia da v1) até a ponte do Sankhya.

function cabecalho() {
  const tela = acharTela(ROTA_DAS_OPERACOES)?.tela;
  return { titulo: tela?.nome ?? "Operações", descricao: tela?.descricao };
}

export const CLASSE_DO_MES =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm tabular-nums outline-none focus-visible:ring-3";

export function paraParametros(
  bruto: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(bruto)) {
    for (const item of Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]) {
      parametros.append(chave, item);
    }
  }
  return parametros;
}

const APRESENTACAO = {
  tipo: {
    titulo: "Tipo",
    subtitulo: "O que a operação é",
    forma: "retangulo",
    destaque: "escuro",
  },
  filial: {
    titulo: "Filial",
    subtitulo: "A garagem da base",
    forma: "retangulo",
    destaque: "escuro",
  },
} as const;

function chipsDe(contagens: Record<string, number> | null): ChipDeConsulta[] {
  return [
    ...CHIPS_DE_TIPO.map((c) => ({ ...c, grupo: "tipo", contagem: contagens?.[c.id] })),
    ...CHIPS_DE_FILIAL.map((c) => ({ ...c, grupo: "filial", contagem: contagens?.[c.id] })),
  ];
}

function Barra({ contagens }: { contagens: Record<string, number> | null }) {
  return (
    <BarraDeConsultaDaPagina
      rotulo="Buscar operação"
      chips={chipsDe(contagens)}
      apresentacaoDosGrupos={APRESENTACAO}
    />
  );
}

/** Os meses com viagem, como links que mantêm a consulta (o mês atual marcado). */
export function SeletorDeMes({
  rota,
  parametros,
  meses,
  atual,
}: {
  rota: string;
  parametros: URLSearchParams;
  meses: readonly string[];
  atual: string;
}) {
  if (meses.length === 0) return null;
  return (
    <nav aria-label="Mês do resultado" className="flex flex-wrap gap-2">
      {meses.slice(0, 12).map((mes) => (
        <Link
          key={mes}
          href={enderecoDoMes(rota, parametros, mes)}
          aria-current={mes === atual ? "page" : undefined}
          className={cn(
            CLASSE_DO_MES,
            mes === atual && "bg-primary text-primary-foreground hover:bg-primary",
          )}
        >
          {formatarMes(mes)}
        </Link>
      ))}
    </nav>
  );
}

function kpisDe(dados: OperacoesDoMes): Kpi[] {
  const { totais } = dados;
  const contagem: Kpi[] = [
    { id: "operacoes", rotulo: "Operações", valor: formatarInteiro(totais.operacoes) },
    { id: "placas", rotulo: "Placas agora", valor: formatarInteiro(totais.placas) },
  ];
  if (!totais.cascata) return contagem;
  return [
    ...contagem,
    { id: "receita", rotulo: "Receita", valor: <Moeda valor={totais.cascata.receitaCentavos} /> },
    {
      id: "custos",
      rotulo: "Custo Frota + Serviço",
      valor: (
        <Moeda valor={totais.cascata.custoFrotaCentavos + totais.cascata.custoServicoCentavos} />
      ),
    },
    {
      id: "margem",
      rotulo: "Margem",
      valor: <Moeda valor={totais.cascata.margemCentavos} />,
      apoio:
        totais.cascata.margemPercentual === null
          ? undefined
          : `${formatarPercentual(totais.cascata.margemPercentual)} da receita`,
    },
  ];
}

export function PaginaDeOperacoesCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura
      lista
      titulo={titulo}
      descricao={descricao}
      consulta={<Barra contagens={null} />}
    >
      <EsqueletoDaTabela rotulo="Carregando as operações" />
    </PaginaDeLeitura>
  );
}

async function Conteudo({ parametros }: { parametros: URLSearchParams }) {
  const estado = lerOperacoes(parametros);
  const dados = await lerOperacoesDoMes(estado);
  const filtrando = estado.consulta.busca !== "" || estado.consulta.chips.length > 0;
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura
      lista
      titulo={titulo}
      descricao={descricao}
      consulta={<Barra contagens={dados.chips} />}
    >
      <SeletorDeMes
        rota={ROTA_DAS_OPERACOES}
        parametros={parametros}
        meses={dados.meses}
        atual={dados.mes}
      />
      <FaixaDeKpis kpis={kpisDe(dados)} />
      {!dados.veResultado ? (
        <p className="text-muted-foreground text-sm" data-testid="sem-resultado">
          O resultado em R$ aparece para quem tem acesso a Resultados.
        </p>
      ) : null}
      {dados.linhas.length === 0 ? (
        filtrando ? (
          <ListaVazia
            titulo="Nenhuma operação encontrada"
            descricao="Nenhuma operação combina com a busca e os filtros. Limpe os filtros para ver todas."
            hrefLimpar={dados.mes ? `${ROTA_DAS_OPERACOES}?mes=${dados.mes}` : ROTA_DAS_OPERACOES}
          />
        ) : (
          <ListaVazia
            titulo="Nenhuma operação para mostrar"
            descricao="As operações aparecem aqui quando estiverem no catálogo de Cadastros e ao seu alcance."
          />
        )
      ) : (
        <>
          <TabelaDeOperacoes linhas={dados.linhas} veResultado={dados.veResultado} />
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {dados.linhas.length === 1
              ? "1 operação"
              : `${formatarInteiro(dados.linhas.length)} operações`}{" "}
            em {formatarMes(dados.mes)}
          </p>
        </>
      )}
    </PaginaDeLeitura>
  );
}

export async function PaginaDeOperacoes({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const parametros = paraParametros(await searchParams);
  if (modoDosDados() !== "banco") {
    const { titulo, descricao } = cabecalho();
    return (
      <PaginaDeLeitura lista titulo={titulo} descricao={descricao}>
        <ListaVazia
          titulo="As Operações leem só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para ver a cascata de cada operação."
        />
      </PaginaDeLeitura>
    );
  }
  return <Conteudo parametros={parametros} />;
}
