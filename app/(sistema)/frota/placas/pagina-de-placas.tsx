import { cookies } from "next/headers";
import { connection } from "next/server";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import { BarraDeConsultaDaPagina } from "@/components/layout/barra-de-consulta";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { DensidadeDaTabela } from "@/components/tabela/densidade";
import { MaisFiltrosDePlacas, MaisFiltrosReservado } from "@/components/tabela/mais-filtros";
import { ModoFoco } from "@/components/tabela/modo-foco";
import { Paginador } from "@/components/tabela/paginador";
import { SeletorDeColunas } from "@/components/tabela/seletor-de-colunas";
import { ProvedorDaLista } from "@/components/tabela/pendencia-da-lista";
import { TabelaDePlacas } from "@/components/tabela/tabela-de-placas";
import {
  CAMPOS_ORDENAVEIS_DE_PLACAS,
  DEFINICOES_DAS_COLUNAS_DE_PLACAS,
  IDS_DAS_COLUNAS_DE_PLACAS,
  listarPlacas,
  NOMES_DOS_TIPOS,
  PADRAO_DA_LISTA_DE_PLACAS,
  TIPOS_DE_ATIVO,
  TITULOS_DAS_COLUNAS_DE_PLACAS,
} from "@/lib/dados/placas";
import { NOMES_DOS_CHIPS } from "@/lib/dominio/status";
import { acharTela } from "@/lib/navegacao/catalogo";
import { dicaDoChipDeSituacao } from "@/lib/navegacao/filtros-avancados";
import { lerPreferencias, NOME_DO_COOKIE_DE_PLACAS } from "@/lib/navegacao/preferencias-da-tabela";
import {
  type ConsultaDeTabela,
  escreverTabela,
  lerTabela,
  type PadraoDaTabela,
} from "@/lib/navegacao/tabela";
import { STATUS } from "@/lib/visual/tons";

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

const ROTA = "/frota/placas";

function cabecalho() {
  const tela = acharTela(ROTA)?.tela;
  return { titulo: tela?.nome ?? "Placas", descricao: tela?.descricao };
}

function paraParametros(bruto: Record<string, string | string[] | undefined>): URLSearchParams {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(bruto)) {
    for (const item of Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]) {
      parametros.append(chave, item);
    }
  }
  return parametros;
}

/** `?lento=ms` e `?falha=1` deixam testar os estados da tela; só a fonte de exemplo os obedece. */
function simulacaoDe(parametros: URLSearchParams) {
  const lento = Number(parametros.get("lento"));
  return {
    lentoMs: Number.isFinite(lento) && lento > 0 ? Math.min(lento, 5000) : undefined,
    falha: parametros.get("falha") === "1",
  };
}

function comFiltros(c: ConsultaDeTabela): boolean {
  return c.busca !== "" || c.chips.length > 0 || c.siglas.length > 0 || c.baixadas;
}

/** A mesma tela sem busca, chips, siglas nem baixadas; o contexto global (período etc.) fica. */
function enderecoSemFiltros(
  parametros: URLSearchParams,
  consulta: ConsultaDeTabela,
  padrao: PadraoDaTabela,
): string {
  const limpa = escreverTabela(
    parametros,
    { ...consulta, busca: "", chips: [], siglas: [], baixadas: false, pagina: 1 },
    padrao,
  ).toString();
  return limpa ? `${ROTA}?${limpa}` : ROTA;
}

/** Os dois grupos de chips: situação (cinco chips) e tipo de ativo (seis). */
function chipsDaLista(contagens?: Record<string, number>) {
  return [
    ...STATUS.map((id) => ({
      id,
      nome: NOMES_DOS_CHIPS[id],
      grupo: "Situação",
      dica: dicaDoChipDeSituacao(id),
      ...(contagens ? { contagem: contagens[id] ?? 0 } : {}),
    })),
    ...TIPOS_DE_ATIVO.map((id) => ({
      id,
      nome: NOMES_DOS_TIPOS[id],
      grupo: "Tipo",
      ...(contagens ? { contagem: contagens[id] ?? 0 } : {}),
    })),
  ];
}

/** O que a pessoa vê enquanto a página chega: o título, a barra de consulta e o esqueleto. */
export function PaginaDePlacasCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura
      lista
      titulo={titulo}
      descricao={descricao}
      consulta={
        <BarraDeConsultaDaPagina
          rotulo="Buscar placa"
          chips={chipsDaLista()}
          filtrosExtras={["sigla", "baixadas"]}
          maisFiltros={<MaisFiltrosReservado />}
        />
      }
    >
      <EsqueletoDaTabela rotulo="Carregando placas" />
    </PaginaDeLeitura>
  );
}

export async function PaginaDePlacas({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const parametros = paraParametros(await searchParams);
  // As preferências vêm do cookie, validadas; o `tam` da URL, se houver, vale mais.
  const preferencias = lerPreferencias(
    (await cookies()).get(NOME_DO_COOKIE_DE_PLACAS)?.value,
    IDS_DAS_COLUNAS_DE_PLACAS,
  );
  const padrao = { tam: preferencias.tam, ordem: PADRAO_DA_LISTA_DE_PLACAS.ordem };
  const consulta = lerTabela(parametros, padrao, CAMPOS_ORDENAVEIS_DE_PLACAS);
  const pagina = await listarPlacas(consulta, hojeEmSaoPaulo(new Date()), {
    simulacao: simulacaoDe(parametros),
  });
  const { titulo, descricao } = cabecalho();
  const filtrosAtivos = comFiltros(consulta);
  const emFoco = parametros.get("foco") === "1";

  return (
    <ProvedorDaLista preferenciasIniciais={preferencias}>
      <PaginaDeLeitura
        lista
        emFoco={emFoco}
        titulo={titulo}
        descricao={descricao}
        consulta={
          <BarraDeConsultaDaPagina
            rotulo="Buscar placa"
            chips={chipsDaLista(pagina.contagens)}
            filtrosExtras={["sigla", "baixadas"]}
            maisFiltros={
              <MaisFiltrosDePlacas padrao={padrao} campos={CAMPOS_ORDENAVEIS_DE_PLACAS} />
            }
          />
        }
      >
        {pagina.total === 0 ? (
          filtrosAtivos ? (
            <ListaVazia
              titulo="Nenhuma placa encontrada"
              descricao="Nenhuma placa combina com a busca e os filtros escolhidos. Tire um filtro ou limpe tudo para ver a lista inteira."
              hrefLimpar={enderecoSemFiltros(parametros, consulta, padrao)}
            />
          ) : (
            <ListaVazia
              titulo="Ainda não há placas"
              descricao="Quando houver placas cadastradas, elas aparecem aqui."
            />
          )
        ) : (
          <TabelaDePlacas linhas={pagina.linhas} ordem={consulta.ordem} padrao={padrao} />
        )}
        <Paginador
          pagina={pagina.pagina}
          paginas={pagina.paginas}
          total={pagina.total}
          tam={pagina.tam}
          itens="placas"
          padrao={padrao}
          campos={CAMPOS_ORDENAVEIS_DE_PLACAS}
          ferramentas={
            <>
              <ModoFoco />
              <SeletorDeColunas
                definicoes={DEFINICOES_DAS_COLUNAS_DE_PLACAS}
                titulos={TITULOS_DAS_COLUNAS_DE_PLACAS}
              />
              <DensidadeDaTabela />
            </>
          }
        />
      </PaginaDeLeitura>
    </ProvedorDaLista>
  );
}
