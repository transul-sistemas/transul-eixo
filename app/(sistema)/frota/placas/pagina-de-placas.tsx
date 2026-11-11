import { cookies } from "next/headers";
import { connection } from "next/server";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import {
  type ApresentacaoDoGrupo,
  BarraDeConsultaDaPagina,
} from "@/components/layout/barra-de-consulta";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { DensidadeDaTabela } from "@/components/tabela/densidade";
import { MaisFiltrosDePlacas, MaisFiltrosReservado } from "@/components/tabela/mais-filtros";
import { ModoFoco } from "@/components/tabela/modo-foco";
import { PainelDeEspiar } from "@/components/tabela/painel-de-espiar";
import { RestauradorDaLista } from "@/components/tabela/retorno-da-lista-no-navegador";
import { Paginador } from "@/components/tabela/paginador";
import { SeletorDeColunas } from "@/components/tabela/seletor-de-colunas";
import { ProvedorDaLista } from "@/components/tabela/pendencia-da-lista";
import { TabelaDePlacas } from "@/components/tabela/tabela-de-placas";
import {
  CHIP_PARA_RECEBER,
  camposOrdenaveisDePlacas,
  colunasDePlacas,
  dadosDoPainel,
  IDS_DAS_COLUNAS_DE_PLACAS,
  listarPlacas,
  NOMES_DOS_TIPOS,
  PADRAO_DA_LISTA_DE_PLACAS,
  TIPOS_DE_ATIVO,
  TITULOS_DAS_COLUNAS_DE_PLACAS,
} from "@/lib/dados/placas";
import { NOMES_DOS_CHIPS } from "@/lib/dominio/status";
import { acharTela } from "@/lib/navegacao/catalogo";
import { lerEspiar } from "@/lib/navegacao/espiar";
import { dicaDoChipDeSituacao } from "@/lib/navegacao/filtros-avancados";
import {
  lerPreferencias,
  lerTamanhoLembrado,
  NOME_DO_COOKIE_DE_PLACAS,
  NOME_DO_COOKIE_DO_TAMANHO,
} from "@/lib/navegacao/preferencias-da-tabela";
import {
  type ConsultaDeTabela,
  escreverTabela,
  lerTabela,
  type PadraoDaTabela,
} from "@/lib/navegacao/tabela";
import { STATUS } from "@/lib/visual/tons";
import { AssistentesDaFrota } from "./assistentes/assistentes-da-frota";
import { carregarDadosDosAssistentes } from "./assistentes/carregar-dados";
import { contarParaReceber, modoDosDados } from "@/lib/dados/fonte";
import { FaixaParaReceberNaLista } from "./faixa-para-receber";

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

const ROTA = "/frota/placas";

function cabecalho() {
  const tela = acharTela(ROTA)?.tela;
  return { titulo: tela?.nome ?? "Placas", descricao: tela?.descricao };
}

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

/** `?lento=ms` e `?falha=1` deixam testar os estados da tela; só a fonte de exemplo os obedece. */
export function simulacaoDe(parametros: URLSearchParams) {
  const lento = Number(parametros.get("lento"));
  return {
    lentoMs: Number.isFinite(lento) && lento > 0 ? Math.min(lento, 5000) : undefined,
    falha:
      parametros.get("falha") === "funcao-ausente"
        ? ("funcao-ausente" as const)
        : parametros.get("falha") === "1",
    falhaNoPainel: parametros.get("falhaNoPainel") === "1",
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

/**
 * Como cada grupo aparece: Para receber (o que espera por quem usa, na linha da busca), Situação (como a placa
 * está agora) e Tipo de ativo (o que é a placa).
 */
const GRUPOS_DA_LISTA: Readonly<Record<string, ApresentacaoDoGrupo>> = {
  receber: {
    titulo: "Para receber",
    subtitulo: "placas que esperam por você",
    forma: "pilula",
    destaque: "acao",
    naLinhaDaBusca: true,
  },
  situacao: {
    titulo: "Situação",
    subtitulo: "como a placa está agora",
    forma: "pilula",
    destaque: "acao",
  },
  tipo: {
    titulo: "Tipo de ativo",
    subtitulo: "o que é a placa",
    forma: "retangulo",
    destaque: "escuro",
  },
};

/**
 * Os grupos de chips: "Para receber" (só quando há placa esperando ou o chip está escolhido),
 * situação (cinco chips) e tipo de ativo (cinco).
 */
function chipsDaLista(contagens?: Record<string, number>, comParaReceber = false) {
  return [
    ...(comParaReceber
      ? [
          {
            id: CHIP_PARA_RECEBER,
            nome: "Para receber",
            grupo: "receber",
            dica: "As placas que outro gestor disponibilizou para você: receba e conclua o recebimento.",
            ...(contagens ? { contagem: contagens[CHIP_PARA_RECEBER] ?? 0 } : {}),
          },
        ]
      : []),
    ...STATUS.map((id) => ({
      id,
      nome: NOMES_DOS_CHIPS[id],
      grupo: "situacao",
      tom: id,
      dica: dicaDoChipDeSituacao(id),
      ...(contagens ? { contagem: contagens[id] ?? 0 } : {}),
    })),
    ...TIPOS_DE_ATIVO.map((id) => ({
      id,
      nome: NOMES_DOS_TIPOS[id],
      grupo: "tipo",
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
          apresentacaoDosGrupos={GRUPOS_DA_LISTA}
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
  const padrao = {
    tam: lerTamanhoLembrado(
      (await cookies()).get(NOME_DO_COOKIE_DO_TAMANHO)?.value,
      preferencias.tam,
    ),
    ordem: PADRAO_DA_LISTA_DE_PLACAS.ordem,
  };
  // No modo banco, KM, motorista e CRLV ainda não têm fonte: somem as colunas e a ordem por eles.
  const modo = modoDosDados();
  const campos = camposOrdenaveisDePlacas(modo);
  const definicoes = colunasDePlacas(modo);
  const consulta = lerTabela(parametros, padrao, campos);
  const hoje = hojeEmSaoPaulo(new Date());
  const opcoes = { simulacao: simulacaoDe(parametros) };
  // O painel busca em paralelo com a lista e nunca a derruba: se falha, o erro fica no painel.
  const [pagina, dadosDoPainelDaUrl, dadosDosAssistentes, paraReceber] = await Promise.all([
    listarPlacas(consulta, hoje, opcoes),
    dadosDoPainel(lerEspiar(parametros), hoje, opcoes),
    carregarDadosDosAssistentes({
      assistente: parametros.get("assistente"),
      placa: parametros.get("placa"),
      hoje,
    }),
    contarParaReceber(hoje),
  ]);
  const comParaReceber = paraReceber > 0 || consulta.chips.includes(CHIP_PARA_RECEBER);
  const hrefParaReceber = (() => {
    const filtrada = escreverTabela(
      parametros,
      { ...consulta, chips: [CHIP_PARA_RECEBER], pagina: 1 },
      padrao,
    ).toString();
    return `${ROTA}?${filtrada}`;
  })();
  const { titulo, descricao } = cabecalho();
  const filtrosAtivos = comFiltros(consulta);
  const emFoco = parametros.get("foco") === "1";

  return (
    <ProvedorDaLista preferenciasIniciais={preferencias} nomeDoCookie={NOME_DO_COOKIE_DE_PLACAS}>
      <PaginaDeLeitura
        lista
        emFoco={emFoco}
        titulo={titulo}
        descricao={descricao}
        acoes={
          dadosDosAssistentes ? (
            <AssistentesDaFrota dados={dadosDosAssistentes} comBotaoDeCadastrar />
          ) : undefined
        }
        consulta={
          <BarraDeConsultaDaPagina
            rotulo="Buscar placa"
            chips={chipsDaLista(pagina.contagens, comParaReceber)}
            apresentacaoDosGrupos={GRUPOS_DA_LISTA}
            filtrosExtras={["sigla", "baixadas"]}
            maisFiltros={<MaisFiltrosDePlacas padrao={padrao} campos={campos} />}
            aviso={
              consulta.chips.includes(CHIP_PARA_RECEBER) ? null : (
                <FaixaParaReceberNaLista quantidade={paraReceber} hrefDoFiltro={hrefParaReceber} />
              )
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
          <TabelaDePlacas
            linhas={pagina.linhas}
            ordem={consulta.ordem}
            padrao={padrao}
            modo={modo}
          />
        )}
        <Paginador
          pagina={pagina.pagina}
          paginas={pagina.paginas}
          total={pagina.total}
          tam={pagina.tam}
          itens="placas"
          padrao={padrao}
          campos={campos}
          ferramentas={
            <>
              <ModoFoco />
              <SeletorDeColunas definicoes={definicoes} titulos={TITULOS_DAS_COLUNAS_DE_PLACAS} />
              <DensidadeDaTabela />
            </>
          }
        />
      </PaginaDeLeitura>
      <RestauradorDaLista placasDaPagina={pagina.linhas.map((linha) => linha.placa)} />
      <PainelDeEspiar
        dados={dadosDoPainelDaUrl}
        placasDaPagina={pagina.linhas.map((linha) => linha.placa)}
      />
    </ProvedorDaLista>
  );
}
