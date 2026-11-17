import { IconAlertTriangle } from "@tabler/icons-react";
import { enderecoDoCsv } from "@/lib/navegacao/exportacao";
import { cookies } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { formatarMes } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro, formatarPercentual } from "@/components/formato/numero";
import {
  BarraDeConsultaDaPagina,
  type ChipDeConsulta,
} from "@/components/layout/barra-de-consulta";
import { ROTULO_DE_MES_INCOMPLETO } from "@/components/layout/aviso-de-dados-congelados";
import { FaixaDeKpis, type Kpi } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { Paginador } from "@/components/tabela/paginador";
import { lerDadosAte } from "@/lib/dados/dados-ate";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerOperacoesDoMes, type OperacoesDoMes } from "@/lib/dados/operacoes";
import { lerMesFechado } from "@/lib/dados/operacoes-ficha";
import { mesIncompleto } from "@/lib/dominio/dados-congelados";
import { chipsDeMes, somarMeses, variacaoPercentual } from "@/lib/dominio/periodo";
import { acharTela } from "@/lib/navegacao/catalogo";
import {
  CAMPOS_DAS_OPERACOES,
  CHIPS_DE_FILIAL,
  CHIPS_DE_TIPO,
  enderecoDoMes,
  lerOperacoes,
  PADRAO_DAS_OPERACOES,
  ROTA_DAS_OPERACOES,
} from "@/lib/navegacao/operacoes";
import {
  lerTamanhoLembrado,
  NOME_DO_COOKIE_DO_TAMANHO,
} from "@/lib/navegacao/preferencias-da-tabela";
import { cn } from "@/lib/utils";
import { TabelaDeOperacoes } from "./tabela-de-operacoes";

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

// Operações › lista (primeira versão): cada operação com filial, CRs, placas vinculadas agora e a
// cascata do mês (receita, custo da Frota, custo de Serviço e margem), prontas no banco. Os números
// vêm do staging provisório (a cópia da v1) até a ponte do Sankhya. O banco filtra, ordena e pagina
// (20 por página por padrão, com 20, 50 e 100 lembrado por pessoa); os KPIs são do filtro inteiro.

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
  mesIncompleto = null,
}: {
  rota: string;
  parametros: URLSearchParams;
  meses: readonly string[];
  atual: string;
  /** O mês `aaaa-mm` com dados só até o meio (rotulado, nunca padrão); vem da data limite do staging. */
  mesIncompleto?: string | null;
}) {
  // O mês incompleto entra na frente (do mais recente ao mais antigo), com o rótulo.
  const lista =
    mesIncompleto && !meses.includes(mesIncompleto) ? [mesIncompleto, ...meses] : [...meses];
  if (lista.length === 0) return null;
  return (
    <nav aria-label="Mês do resultado" className="flex flex-wrap gap-2">
      {lista.slice(0, 12).map((mes) => (
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
          {mes === mesIncompleto ? (
            <span className="ml-2 inline-flex items-center gap-1 text-xs">
              <IconAlertTriangle aria-hidden className="size-3.5" />
              {ROTULO_DE_MES_INCOMPLETO}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export const SEM_DADOS_DE_RESULTADO =
  "Sem dados ainda: depende da ponte do Sankhya (viagens e despesas).";

/** Sem receita nem custo no filtro inteiro: não é resultado, é falta de fonte. */
function semLancamentosNaLista(dados: OperacoesDoMes): boolean {
  const c = dados.totais.cascata;
  return (
    c !== null &&
    c.receitaCentavos === 0 &&
    c.custoFrotaCentavos === 0 &&
    c.custoServicoCentavos === 0
  );
}

function kpisDe(dados: OperacoesDoMes, anterior: OperacoesDoMes | null): Kpi[] {
  const { totais } = dados;
  const contra = "o mês anterior";
  const a = anterior?.totais.cascata ?? null;
  const contagem: Kpi[] = [
    { id: "operacoes", rotulo: "Operações", valor: formatarInteiro(totais.operacoes) },
    { id: "placas", rotulo: "Placas agora", valor: formatarInteiro(totais.placas) },
  ];
  const c = totais.cascata;
  if (!c) return contagem;
  if (semLancamentosNaLista(dados)) {
    return [
      ...contagem,
      { id: "receita", rotulo: "Receita", valor: null, semDados: SEM_DADOS_DE_RESULTADO },
      {
        id: "custos",
        rotulo: "Custo Frota + Serviço",
        valor: null,
        semDados: SEM_DADOS_DE_RESULTADO,
      },
      { id: "margem", rotulo: "Margem", valor: null, semDados: SEM_DADOS_DE_RESULTADO },
    ];
  }
  const custos = c.custoFrotaCentavos + c.custoServicoCentavos;
  return [
    ...contagem,
    {
      id: "receita",
      rotulo: "Receita",
      valor: <Moeda valor={c.receitaCentavos} />,
      variacao: { pontos: variacaoPercentual(c.receitaCentavos, a?.receitaCentavos), contra },
    },
    {
      id: "custos",
      rotulo: "Custo Frota + Serviço",
      valor: <Moeda valor={custos} />,
      variacao: {
        pontos: variacaoPercentual(
          custos,
          a ? a.custoFrotaCentavos + a.custoServicoCentavos : null,
        ),
        bomQuando: "cair",
        contra,
      },
    },
    {
      id: "margem",
      rotulo: "Margem",
      valor: <Moeda valor={c.margemCentavos} />,
      variacao: { pontos: variacaoPercentual(c.margemCentavos, a?.margemCentavos), contra },
      apoio:
        c.margemPercentual === null
          ? undefined
          : `${formatarPercentual(c.margemPercentual)} da receita`,
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
  const tam = lerTamanhoLembrado(
    (await cookies()).get(NOME_DO_COOKIE_DO_TAMANHO)?.value,
    PADRAO_DAS_OPERACOES.tam,
  );
  const estadoDaUrl = lerOperacoes(parametros, tam);
  // O mês padrão é o mês fechado mais recente (e não o último com viagem no staging da v1).
  const [mesFechado, dadosAte] = await Promise.all([lerMesFechado(), lerDadosAte()]);
  const mes = estadoDaUrl.mes ?? mesFechado;
  const estado = { ...estadoDaUrl, mes };
  const [dados, anterior] = await Promise.all([
    lerOperacoesDoMes(estado),
    lerOperacoesDoMes({
      mes: somarMeses(mes, -1),
      consulta: { ...estado.consulta, pagina: 1, tam: 20 },
    }),
  ]);
  const filtrando = estado.consulta.busca !== "" || estado.consulta.chips.length > 0;
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura
      lista
      titulo={titulo}
      descricao={descricao}
      consulta={<Barra contagens={dados.chips} />}
      exportar={enderecoDoCsv("operacoes.lista", parametros)}
      dadosAte={dadosAte}
    >
      <SeletorDeMes
        rota={ROTA_DAS_OPERACOES}
        parametros={parametros}
        meses={chipsDeMes(mesFechado).reverse()}
        atual={dados.mes}
        mesIncompleto={mesIncompleto(dadosAte)}
      />
      <FaixaDeKpis kpis={kpisDe(dados, anterior)} />
      {!dados.veResultado ? (
        <p className="text-muted-foreground text-sm" data-testid="sem-resultado">
          O resultado em R$ aparece para quem tem acesso a Resultados.
        </p>
      ) : null}
      {dados.total === 0 ? (
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
        <TabelaDeOperacoes
          linhas={dados.linhas}
          veResultado={dados.veResultado}
          semDados={semLancamentosNaLista(dados)}
        />
      )}
      <Paginador
        pagina={dados.pagina}
        paginas={dados.paginas}
        total={dados.total}
        tam={dados.tam}
        itens="operações"
        padrao={{ ...PADRAO_DAS_OPERACOES, tam }}
        campos={CAMPOS_DAS_OPERACOES}
      />
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
