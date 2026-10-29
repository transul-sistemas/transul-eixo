import { connection } from "next/server";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import { BarraDeConsultaDaPagina } from "@/components/layout/barra-de-consulta";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { EsqueletoDaTabela } from "@/components/tabela/estados";
import { Paginador } from "@/components/tabela/paginador";
import { TabelaDePlacas } from "@/components/tabela/tabela-de-placas";
import {
  CAMPOS_ORDENAVEIS_DE_PLACAS,
  listarPlacas,
  PADRAO_DA_LISTA_DE_PLACAS,
} from "@/lib/dados/placas";
import { NOMES_DOS_CHIPS } from "@/lib/dominio/status";
import { acharTela } from "@/lib/navegacao/catalogo";
import { lerTabela } from "@/lib/navegacao/tabela";
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

/** O que a pessoa vê enquanto a página chega: o título, a barra de consulta e o esqueleto. */
export function PaginaDePlacasCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura
      titulo={titulo}
      descricao={descricao}
      consulta={
        <BarraDeConsultaDaPagina
          rotulo="Buscar placa"
          chips={STATUS.map((id) => ({ id, nome: NOMES_DOS_CHIPS[id] }))}
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
  const consulta = lerTabela(parametros, PADRAO_DA_LISTA_DE_PLACAS, CAMPOS_ORDENAVEIS_DE_PLACAS);
  const pagina = await listarPlacas(consulta, hojeEmSaoPaulo(new Date()), {
    simulacao: simulacaoDe(parametros),
  });
  const { titulo, descricao } = cabecalho();

  return (
    <PaginaDeLeitura
      titulo={titulo}
      descricao={descricao}
      consulta={
        <BarraDeConsultaDaPagina
          rotulo="Buscar placa"
          chips={STATUS.map((id) => ({
            id,
            nome: NOMES_DOS_CHIPS[id],
            contagem: pagina.contagens[id] ?? 0,
          }))}
        />
      }
    >
      <TabelaDePlacas linhas={pagina.linhas} ordem={consulta.ordem} />
      <Paginador
        pagina={pagina.pagina}
        paginas={pagina.paginas}
        total={pagina.total}
        tam={pagina.tam}
        itens="placas"
        padrao={PADRAO_DA_LISTA_DE_PLACAS}
        campos={CAMPOS_ORDENAVEIS_DE_PLACAS}
      />
    </PaginaDeLeitura>
  );
}
