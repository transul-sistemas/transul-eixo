import { formatarData, formatarDataEHora, formatarMes } from "@/components/formato/data";
import { formatarMoeda } from "@/components/formato/moeda-valor";
import {
  formatarInteiro,
  formatarKm,
  formatarKmPorLitro,
  formatarLitros,
  formatarPercentual,
} from "@/components/formato/numero";
import { textoDoValor } from "@/components/formato/texto";
import { lerCarteiraDoMes } from "@/lib/dados/acompanhamento";
import { lerAbastecimentoDoMes } from "@/lib/dados/abastecimento";
import { type ClienteDeCadastros, listarCatalogo } from "@/lib/dados/catalogos-cadastro";
import { catalogoPorId } from "@/lib/dados/catalogos-definicoes";
import type { ClienteDeEscrita } from "@/lib/dados/escrita-do-banco";
import { lerOrdens, lerPatio } from "@/lib/dados/operacional";
import { lerOperacoesDoMes } from "@/lib/dados/operacoes";
import { NOMES_DOS_TIPOS_DE_OPERACAO } from "@/lib/dados/operacoes-tipos";
import { type IdDoPainel, lerPainel } from "@/lib/dados/paineis";
import { lerConciliacaoDoMes, lerLocacoes, lerParceirosDoMes } from "@/lib/dados/parceiros";
import {
  NOMES_DAS_SITUACOES_DA_CONCILIACAO,
  NOMES_DAS_SITUACOES_DA_LOCACAO,
} from "@/lib/dados/parceiros-tipos";
import { lerPessoasDaLista } from "@/lib/dados/pessoas";
import { NOMES_DAS_SITUACOES } from "@/lib/dados/pessoas-tipos";
import { listarPlacas } from "@/lib/dados/placas";
import {
  camposOrdenaveisDePlacas,
  NOMES_DOS_TIPOS,
  PADRAO_DA_LISTA_DE_PLACAS,
} from "@/lib/dados/placas-tipos";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerProblemaDaSaude } from "@/lib/dados/saude-do-cr";
import { lerTarefas } from "@/lib/dados/tarefas";
import { listarUsuarios } from "@/lib/dados/usuarios-e-perfis";
import { PROBLEMAS_DA_SAUDE } from "@/lib/dominio/esquemas/dia-cr-e-baixa";
import { montarTarefas } from "@/lib/dominio/tarefas";
import { lerAbastecimento } from "@/lib/navegacao/abastecimento";
import { lerCarteira } from "@/lib/navegacao/acompanhamento";
import { lerOrdensDaUrl, lerPatioDaUrl } from "@/lib/navegacao/operacional";
import { lerOperacoes } from "@/lib/navegacao/operacoes";
import { lerEstadoDoPainel } from "@/lib/navegacao/painel";
import { lerConciliacao, lerLocacao, lerParceiros } from "@/lib/navegacao/parceiros";
import { lerPessoas } from "@/lib/navegacao/pessoas";
import {
  type IdDaLista,
  type IdDaListaDePainel,
  type IdDaListaPropria,
  LISTAS_DE_PAINEL,
} from "@/lib/navegacao/exportacao";
import { lerTabela } from "@/lib/navegacao/tabela";

// Os exportadores das listas (Exportar CSV): cada um lê a lista INTEIRA (página a página, 100 por vez, até
// o teto), com os filtros que vieram na URL e a sessão de quem pede (a RLS decide o que entra). Tudo sai
// já em texto, pelos formatadores de components/formato/; quem monta o arquivo é montarCsv.

/** O teto de linhas de um CSV (proteção): acima disso o arquivo sai cortado e o cabeçalho avisa. */
export const TETO_DE_LINHAS = 10_000;
const POR_VEZ = 100;

export interface ArquivoCsv {
  cabecalho: string[];
  linhas: (string | null)[][];
  cortada: boolean;
}

/** Lê página por página até acabar ou chegar ao teto. */
export async function todasAsPaginas<T>(
  ler: (pagina: number, tam: number) => Promise<{ linhas: T[]; paginas: number }>,
): Promise<{ linhas: T[]; cortada: boolean }> {
  const linhas: T[] = [];
  for (let pagina = 1; ; pagina++) {
    const r = await ler(pagina, POR_VEZ);
    linhas.push(...r.linhas);
    if (linhas.length >= TETO_DE_LINHAS)
      return { linhas: linhas.slice(0, TETO_DE_LINHAS), cortada: true };
    if (pagina >= r.paginas || r.linhas.length === 0) return { linhas, cortada: false };
  }
}

const sim = (b: boolean | null | undefined) =>
  b === null || b === undefined ? null : b ? "Sim" : "Não";

async function clienteDaSessao<T>(): Promise<T> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as T;
}

/** As telas de painel: a tabela da leitura, coluna por coluna, no formato que a fonte disse. */
async function exportarPainel(
  id: IdDaListaDePainel,
  parametros: URLSearchParams,
  hoje: string,
): Promise<ArquivoCsv> {
  const estado = lerEstadoDoPainel(parametros);
  let colunas: { id: string; rotulo: string; formato: Parameters<typeof textoDoValor>[1] }[] = [];
  const { linhas, cortada } = await todasAsPaginas(async (pagina, tam) => {
    const l = await lerPainel(id as IdDoPainel, { ...estado, pagina, tam }, hoje);
    colunas = l.tabela.colunas;
    return { linhas: l.tabela.linhas, paginas: l.tabela.paginas };
  });
  return {
    cabecalho: colunas.map((c) => c.rotulo),
    linhas: linhas.map((l) => colunas.map((c) => textoDoValor(l.celulas[c.id] ?? null, c.formato))),
    cortada,
  };
}

type Exportador = (parametros: URLSearchParams, hoje: string) => Promise<ArquivoCsv>;

const PROPRIOS: Record<IdDaListaPropria, Exportador> = {
  "inicio.tarefas": async () => {
    const tarefas = montarTarefas(await lerTarefas());
    return {
      cabecalho: ["Tarefa", "Quantidade"],
      linhas: tarefas.map((t) => [t.texto, formatarInteiro(t.quantidade)]),
      cortada: false,
    };
  },
  "frota.placas": async (parametros, hoje) => {
    const consulta = lerTabela(
      parametros,
      PADRAO_DA_LISTA_DE_PLACAS,
      camposOrdenaveisDePlacas(modoDosDados()),
    );
    const { linhas, cortada } = await todasAsPaginas((pagina, tam) =>
      listarPlacas({ ...consulta, pagina, tam }, hoje),
    );
    return {
      cabecalho: [
        "Placa",
        "Tipo",
        "Modelo",
        "Gestor",
        "Operação",
        "CR",
        "Situação",
        "Dias na situação",
        "Filial",
        "Valor FIPE",
      ],
      linhas: linhas.map((l) => [
        l.placa,
        NOMES_DOS_TIPOS[l.tipo],
        l.modelo,
        l.gestor,
        l.operacao,
        l.cr,
        `${l.sigla} · ${l.nomeDaSituacao}`,
        formatarInteiro(l.diasNoStatus),
        l.filial,
        l.valorFipeCentavos === null ? null : formatarMoeda(l.valorFipeCentavos),
      ]),
      cortada,
    };
  },
  "frota.abastecimento": async (parametros) => {
    const estado = lerAbastecimento(parametros);
    const { linhas, cortada } = await todasAsPaginas((pagina, tam) =>
      lerAbastecimentoDoMes({ ...estado, consulta: { ...estado.consulta, pagina, tam } }),
    );
    return {
      cabecalho: [
        "Placa",
        "Tipo",
        "Modelo",
        "Abastecimentos",
        "Litros",
        "KM",
        "km/l",
        "Valor",
        "Sem hodômetro",
      ],
      linhas: linhas.map((l) => [
        l.placa,
        l.tipo ? NOMES_DOS_TIPOS[l.tipo] : null,
        l.modelo,
        formatarInteiro(l.abastecimentos),
        formatarLitros(l.litros),
        formatarKm(l.km),
        l.kmPorLitro === null ? null : formatarKmPorLitro(l.kmPorLitro),
        l.valorCentavos === null ? null : formatarMoeda(l.valorCentavos),
        formatarInteiro(l.semHodometro),
      ]),
      cortada,
    };
  },
  "frota.carteira": async (parametros, hoje) => {
    const estado = lerCarteira(parametros, hoje);
    const { linhas, cortada } = await todasAsPaginas((pagina, tam) =>
      lerCarteiraDoMes({ ...estado, pagina, tam }),
    );
    return {
      cabecalho: [
        "Mês",
        "Placa",
        "Tipo",
        "Modelo",
        "Situação",
        "Confere",
        "Observação",
        "Confirmada em",
      ],
      linhas: linhas.map((l) => [
        formatarMes(estado.mes),
        l.placa,
        NOMES_DOS_TIPOS[l.tipo],
        l.modelo,
        `${l.sigla}${l.nomeDaSituacao ? ` · ${l.nomeDaSituacao}` : ""}`,
        sim(l.confere),
        l.observacao,
        l.confirmadoEm ? formatarDataEHora(l.confirmadoEm) : null,
      ]),
      cortada,
    };
  },
  // As Exceções têm a rota própria (/frota/excecoes/csv); aqui só para o registro ficar completo.
  "frota.excecoes": async () => ({ cabecalho: [], linhas: [], cortada: false }),
  "operacional.patio": async (parametros) => {
    const estado = lerPatioDaUrl(parametros);
    const { linhas, cortada } = await todasAsPaginas((pagina, tam) =>
      lerPatio({ ...estado, pagina, tam }),
    );
    return {
      cabecalho: [
        "Posição",
        "Placa",
        "Tipo",
        "Modelo",
        "Implementos",
        "Situação",
        "Filial",
        "Chegou em",
        "Ordem",
        "Destino",
      ],
      linhas: linhas.map((l) => [
        l.posicao === null ? null : formatarInteiro(l.posicao),
        l.placa,
        l.tipo,
        l.modelo,
        l.implementos.join(", "),
        `${l.sigla}${l.nomeDaSituacao ? ` · ${l.nomeDaSituacao}` : ""}`,
        l.filial,
        l.chegouEm ? formatarDataEHora(l.chegouEm) : null,
        l.ordemNumero === null ? null : formatarInteiro(l.ordemNumero),
        l.ordemDestino,
      ]),
      cortada,
    };
  },
  "operacional.ordens-de-carregamento": async (parametros) => {
    const estado = lerOrdensDaUrl(parametros);
    const { linhas, cortada } = await todasAsPaginas((pagina, tam) =>
      lerOrdens({ ...estado, pagina, tam }),
    );
    return {
      cabecalho: [
        "Ordem",
        "Placa",
        "Filial",
        "Operação",
        "Destino",
        "Data prevista",
        "Situação",
        "Criada em",
        "Carregada em",
        "Saiu em",
      ],
      linhas: linhas.map((o) => [
        formatarInteiro(o.numero),
        o.placa,
        o.filial,
        o.operacao,
        o.destino,
        formatarData(o.dataPrevista),
        o.situacao === "em_viagem"
          ? "Em viagem"
          : o.situacao === "carregada"
            ? "Carregada"
            : "Carregando",
        formatarDataEHora(o.criadaEm),
        o.carregadaEm ? formatarDataEHora(o.carregadaEm) : null,
        o.saiuEm ? formatarDataEHora(o.saiuEm) : null,
      ]),
      cortada,
    };
  },
  "operacoes.lista": async (parametros) => {
    const estado = lerOperacoes(parametros);
    const { linhas, cortada } = await todasAsPaginas((pagina, tam) =>
      lerOperacoesDoMes({ ...estado, consulta: { ...estado.consulta, pagina, tam } }),
    );
    return {
      cabecalho: [
        "Operação",
        "Tipo",
        "Base",
        "Filial",
        "Placas",
        "CRs",
        "Receita",
        "Custo da frota",
        "Custo de serviço",
        "Margem",
        "Margem (%)",
      ],
      linhas: linhas.map((l) => [
        l.nome,
        NOMES_DOS_TIPOS_DE_OPERACAO[l.tipo],
        [l.baseCidade, l.baseUf].filter(Boolean).join("/") || null,
        l.filial,
        formatarInteiro(l.placas),
        formatarInteiro(l.crs),
        l.cascata ? formatarMoeda(l.cascata.receitaCentavos) : null,
        l.cascata ? formatarMoeda(l.cascata.custoFrotaCentavos) : null,
        l.cascata ? formatarMoeda(l.cascata.custoServicoCentavos) : null,
        l.cascata ? formatarMoeda(l.cascata.margemCentavos) : null,
        l.cascata?.margemPercentual == null ? null : formatarPercentual(l.cascata.margemPercentual),
      ]),
      cortada,
    };
  },
  "pessoas.lista": async (parametros) => {
    const estado = lerPessoas(parametros);
    const { linhas, cortada } = await todasAsPaginas((pagina, tam) =>
      lerPessoasDaLista({ ...estado, consulta: { ...estado.consulta, pagina, tam } }),
    );
    return {
      cabecalho: ["Nome", "Situação", "Função", "Operação", "Desde"],
      linhas: linhas.map((l) => [
        l.nome,
        NOMES_DAS_SITUACOES[l.situacao],
        l.funcaoNome,
        l.operacao,
        l.desde ? formatarData(l.desde) : null,
      ]),
      cortada,
    };
  },
  "parceiros.lista": async (parametros) => {
    const estado = lerParceiros(parametros);
    let mes = "";
    const { linhas, cortada } = await todasAsPaginas(async (pagina, tam) => {
      const d = await lerParceirosDoMes({
        ...estado,
        consulta: { ...estado.consulta, pagina, tam },
      });
      mes = d.mes;
      return d;
    });
    return {
      cabecalho: [
        "Mês",
        "Parceiro",
        "Tipos",
        "Agrupador",
        "Placas",
        "Despesa",
        "Receita",
        "Locação mensal",
      ],
      linhas: linhas.map((l) => [
        formatarMes(mes),
        l.nome,
        l.tipos.join(", "),
        l.agrupador?.codigo ?? null,
        formatarInteiro(l.placas),
        formatarMoeda(l.despesaCentavos),
        formatarMoeda(l.receitaCentavos),
        formatarMoeda(l.locacaoMensalCentavos),
      ]),
      cortada,
    };
  },
  "parceiros.conciliacao": async (parametros) => {
    const d = await lerConciliacaoDoMes(lerConciliacao(parametros));
    return {
      cabecalho: [
        "Mês",
        "CR",
        "Parceiro",
        "Placas",
        "Dias",
        "Despesa",
        "Receita",
        "Lançamentos",
        "Com outra placa",
        "Situação",
        "Motivo",
      ],
      linhas: d.linhas.map((l) => [
        formatarMes(d.mes),
        `${l.crCodigo}${l.crNome ? ` · ${l.crNome}` : ""}`,
        l.parceiroNome ?? l.agrupadorNome,
        l.placas.join(", "),
        formatarInteiro(l.dias),
        formatarMoeda(l.despesaCentavos),
        formatarMoeda(l.receitaCentavos),
        formatarInteiro(l.lancamentos),
        formatarMoeda(l.foraDaPlacaCentavos),
        NOMES_DAS_SITUACOES_DA_CONCILIACAO[l.situacao],
        l.motivo,
      ]),
      cortada: false,
    };
  },
  "parceiros.locacao": async (parametros) => {
    const d = await lerLocacoes(lerLocacao(parametros));
    return {
      cabecalho: [
        "Parceiro",
        "Placa",
        "Início",
        "Fim",
        "Valor mensal",
        "Situação",
        "Motivo do encerramento",
      ],
      linhas: d.linhas.map((l) => [
        l.parceiroNome,
        l.placa,
        formatarData(l.inicio),
        l.fim ? formatarData(l.fim) : null,
        formatarMoeda(l.valorMensalCentavos),
        NOMES_DAS_SITUACOES_DA_LOCACAO[l.situacao],
        l.motivoDoEncerramento,
      ]),
      cortada: false,
    };
  },
  "cadastros.catalogos": async (parametros) => {
    const definicao = catalogoPorId(parametros.get("catalogo"));
    const busca = (parametros.get("q") ?? "").trim();
    const arquivados = parametros.get("arquivados") === "1";
    const cliente = await clienteDaSessao<ClienteDeCadastros>();
    const { linhas, cortada } = await todasAsPaginas(async (pagina) =>
      listarCatalogo(cliente, definicao, { busca, pagina, arquivados }),
    );
    return {
      cabecalho: [...definicao.colunas.map((c) => c.titulo), "Arquivado"],
      linhas: linhas.map((l) => [
        ...definicao.colunas.map((c) => l.celulas[c.id] ?? null),
        l.arquivado ? "Sim" : "Não",
      ]),
      cortada,
    };
  },
  "cadastros.saude-do-cr": async (parametros) => {
    const pedido = parametros.get("problema") ?? "";
    const problema = (PROBLEMAS_DA_SAUDE as readonly string[]).includes(pedido)
      ? (pedido as (typeof PROBLEMAS_DA_SAUDE)[number])
      : "placa_sem_cr";
    const cliente = await clienteDaSessao<ClienteDeEscrita>();
    const { linhas, cortada } = await todasAsPaginas(async (pagina, tam) => {
      const p = await lerProblemaDaSaude(cliente, problema, pagina, tam);
      return { linhas: p.linhas, paginas: Math.max(1, Math.ceil(p.total / p.tamanho)) };
    });
    return {
      cabecalho: ["Item", "Detalhe", "Dono", "Prazo"],
      linhas: linhas.map((l) => [
        l.placa ?? l.codigo ?? (l.codcencus === undefined ? null : `Centro ${String(l.codcencus)}`),
        problema === "dois_do_mesmo_tipo"
          ? (l.crs ?? []).map((c) => `${c.codigo} desde ${formatarData(c.inicio)}`).join("; ")
          : problema === "lancamento_sem_cr"
            ? `${formatarInteiro(l.lancamentos ?? 0)} lançamentos`
            : [l.nome, l.tipo, l.tipo_de_cr, l.gestor, l.operacao].filter(Boolean).join(" · "),
        l.dono,
        l.prazo ? formatarData(l.prazo) : null,
      ]),
      cortada,
    };
  },
  "admin.usuarios-e-perfis": async (parametros) => {
    const cliente = await clienteDaSessao<ClienteDeCadastros>();
    const usuarios = await listarUsuarios(cliente, (parametros.get("q") ?? "").trim());
    return {
      cabecalho: ["Nome", "Perfil", "Situação", "Escopo", "Filiais", "Operações"],
      linhas: usuarios.map((u) => [
        u.nome,
        u.perfilNome,
        u.ativo ? "Ativo" : "Inativo",
        u.escopos.join(", "),
        u.filiais.join(", "),
        u.operacoes.join(", "),
      ]),
      cortada: false,
    };
  },
};

/** O CSV de uma lista do catálogo, com os filtros da URL. */
export function exportarLista(
  id: IdDaLista,
  parametros: URLSearchParams,
  hoje: string,
): Promise<ArquivoCsv> {
  if ((LISTAS_DE_PAINEL as readonly string[]).includes(id)) {
    return exportarPainel(id as IdDaListaDePainel, parametros, hoje);
  }
  return PROPRIOS[id as IdDaListaPropria](parametros, hoje);
}

export const EXPORTADORES_PROPRIOS = Object.keys(PROPRIOS);
