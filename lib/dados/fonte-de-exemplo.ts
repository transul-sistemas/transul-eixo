import { cookies } from "next/headers";
import { falhaDeLeitura } from "@/lib/erros/leitura";
import { normalizarPlaca } from "@/lib/dominio/placa";
import { alertasDaPlaca } from "@/lib/dominio/alertas";
import { diasEntre } from "@/lib/dominio/dias";
import { grupoDaSigla, NOMES_DAS_SIGLAS, SIGLAS_DE_BAIXA } from "@/lib/dominio/status";
import { type Armazem, armazemDoProcesso } from "@/lib/exemplo/armazem";
import type { PlacaDeExemplo } from "@/lib/exemplo/placas";
import type { ConsultaDeTabela } from "@/lib/navegacao/tabela";
import { STATUS } from "@/lib/visual/tons";
import { podeEntregar } from "@/lib/dominio/custodia";
import { type FonteDeEscrita, type FonteDePlacas, MENSAGEM_SO_COM_EXEMPLO } from "./fonte";
import {
  CAMPOS_ORDENAVEIS_DE_PLACAS,
  CHIP_PARA_RECEBER,
  type DetalheDaPlaca,
  type FichaDaPlaca,
  type LinhaDePlaca,
  type OpcoesDaConsulta,
  type PaginaDePlacas,
  TIPOS_DE_ATIVO,
} from "./placas-tipos";

// A única porta para lib/exemplo/ (o teste de barramento libera só este arquivo). A consulta roda
// em memória, mas com as mesmas regras que a consulta ao banco terá: filtros, ordem estável com
// desempate pelo id, página limitada e contagens por grupo de chips. Só funciona com
// EIXO_DADOS=exemplo, que nunca é definida na Vercel.

/** O gestor de quem usa no modo exemplo (o destino do pedido de exemplo; ver gestorAtual()). */
const GESTOR_DO_EXEMPLO = "gestor-2";

/** O cookie que separa o armazém de uma sessão (os testes de tela usam um por teste). */
export const COOKIE_DA_SESSAO_DE_EXEMPLO = "eixo-sessao-exemplo";

/** A sessão do pedido atual; fora de um pedido (os testes unitários) não há cookie e vale o padrão. */
async function sessaoDeExemplo(): Promise<string | undefined> {
  try {
    return (await cookies()).get(COOKIE_DA_SESSAO_DE_EXEMPLO)?.value;
  } catch {
    return undefined;
  }
}

const TAM_PADRAO = 25;
const TAM_MAXIMO = 100;

interface GrupoDeChips {
  ids: readonly string[];
  de: (linha: LinhaDePlaca) => string;
}
const GRUPOS_DE_CHIPS: readonly GrupoDeChips[] = [
  { ids: STATUS, de: (linha) => linha.grupo },
  { ids: TIPOS_DE_ATIVO, de: (linha) => linha.tipo },
];

/** Minúscula e sem acento, para busca e ordem não dependerem de caixa nem de acento. */
function simples(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function paraLinhas(placas: PlacaDeExemplo[], hoje: string): LinhaDePlaca[] {
  const placaDe = new Map(placas.map((p) => [p.id, p.placa]));
  return placas.map((p) => {
    const vigentes = p.crs
      .filter((cr) => cr.inicio <= hoje && (cr.fim === null || hoje < cr.fim))
      .sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
    return {
      id: p.id,
      placa: p.placa,
      tipo: p.tipo,
      modelo: p.modelo,
      conjunto: {
        cavalo: p.conjunto.cavaloId ? (placaDe.get(p.conjunto.cavaloId) ?? null) : null,
        implementos: p.conjunto.implementoIds.map((id) => placaDe.get(id) ?? id),
      },
      gestor: p.gestor,
      operacao: p.operacao,
      cr: vigentes.at(-1)?.codigo ?? null,
      sigla: p.sigla,
      nomeDaSituacao: NOMES_DAS_SIGLAS[p.sigla],
      grupo: grupoDaSigla(p.sigla),
      diasNoStatus: Math.max(0, diasEntre(p.desde, hoje)),
      alertas: alertasDaPlaca(
        {
          tipo: p.tipo,
          modelo: p.modelo,
          sigla: p.sigla,
          desde: p.desde,
          motorista: p.motorista,
          crlvVenceEm: p.crlvVenceEm,
          crs: p.crs,
          semCavalo: p.tipo === "implemento" && p.conjunto.cavaloId === null,
        },
        hoje,
      ),
      km: p.km,
      valorFipeCentavos: p.valorFipeCentavos,
      motorista: p.motorista,
      crlvVenceEm: p.crlvVenceEm,
      filial: p.filial,
      // O exemplo não tem garagem (a coluna aparece vazia).
      garagem: null,
    };
  });
}

function textoBuscavel(linha: LinhaDePlaca): string {
  return simples(
    [linha.placa, linha.modelo, linha.gestor, linha.motorista, linha.operacao, linha.cr]
      .filter((parte) => parte !== null)
      .join(" "),
  );
}

type Chave = string | number | null;

function chaveDe(linha: LinhaDePlaca, campo: string): Chave {
  switch (campo) {
    case "tipo":
      return linha.tipo;
    case "modelo":
      return simples(linha.modelo);
    case "conjunto": {
      const { cavalo, implementos } = linha.conjunto;
      return cavalo || implementos.length > 0
        ? [cavalo ?? linha.placa, ...implementos].join(" ")
        : null;
    }
    case "gestor":
      return simples(linha.gestor);
    case "operacao":
      return linha.operacao === null ? null : simples(linha.operacao);
    case "situacao":
      return simples(linha.sigla);
    case "alertas":
      return linha.alertas.length;
    case "km":
      return linha.km;
    case "cr":
      return linha.cr;
    case "fipe":
      return linha.valorFipeCentavos;
    case "dias":
      return linha.diasNoStatus;
    case "filial":
      return simples(linha.filial);
    case "motorista":
      return linha.motorista === null ? null : simples(linha.motorista);
    case "crlv":
      return linha.crlvVenceEm;
    default:
      return linha.placa;
  }
}

/** Vazio sempre no fim, nas duas direções; empate resolvido pelo id, sempre crescente. */
export function comparar(campo: string, sentido: "asc" | "desc") {
  const sinal = sentido === "desc" ? -1 : 1;
  return (a: LinhaDePlaca, b: LinhaDePlaca): number => {
    const x = chaveDe(a, campo);
    const y = chaveDe(b, campo);
    if (x === null && y !== null) return 1;
    if (x !== null && y === null) return -1;
    if (x !== null && y !== null && x !== y) return (x < y ? -1 : 1) * sinal;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

function consultar(consulta: ConsultaDeTabela, hoje: string, armazem: Armazem): PaginaDePlacas {
  const linhas = paraLinhas(armazem.placasParaLista(), hoje);

  const busca = simples(consulta.busca.trim());
  const placaBuscada = normalizarPlaca(consulta.busca);
  const siglas = new Set<string>(consulta.siglas);
  const selecionados = GRUPOS_DE_CHIPS.map((grupo) =>
    consulta.chips.filter((chip) => grupo.ids.includes(chip)),
  );
  const paraReceber = new Set(armazem.pedidosParaReceber(GESTOR_DO_EXEMPLO).map((p) => p.placa));
  const soParaReceber = consulta.chips.includes(CHIP_PARA_RECEBER);

  /** Passa pelos filtros; `ignorar` deixa de fora a seleção de um grupo de chips (para a contagem). */
  const passa = (linha: LinhaDePlaca, ignorar?: number, ignorarReceber = false): boolean => {
    if (!ignorarReceber && soParaReceber && !paraReceber.has(linha.placa)) return false;
    if (!consulta.baixadas && SIGLAS_DE_BAIXA.includes(linha.sigla)) return false;
    if (siglas.size > 0 && !siglas.has(linha.sigla)) return false;
    if (busca !== "") {
      const achou =
        textoBuscavel(linha).includes(busca) ||
        (placaBuscada !== "" && normalizarPlaca(linha.placa).includes(placaBuscada));
      if (!achou) return false;
    }
    return GRUPOS_DE_CHIPS.every((grupo, i) => {
      const escolhidos = selecionados[i] ?? [];
      return i === ignorar || escolhidos.length === 0 || escolhidos.includes(grupo.de(linha));
    });
  };

  const contagens: Record<string, number> = {};
  GRUPOS_DE_CHIPS.forEach((grupo, i) => {
    for (const id of grupo.ids) contagens[id] = 0;
    for (const linha of linhas) if (passa(linha, i)) contagens[grupo.de(linha)]! += 1;
  });
  contagens[CHIP_PARA_RECEBER] = linhas.filter(
    (linha) => paraReceber.has(linha.placa) && passa(linha, undefined, true),
  ).length;

  const campo = (CAMPOS_ORDENAVEIS_DE_PLACAS as readonly string[]).includes(consulta.ordem.campo)
    ? consulta.ordem.campo
    : "placa";
  const filtradas = linhas
    .filter((linha) => passa(linha))
    .sort(comparar(campo, consulta.ordem.sentido));

  const tam =
    Number.isInteger(consulta.tam) && consulta.tam >= 1
      ? Math.min(consulta.tam, TAM_MAXIMO)
      : TAM_PADRAO;
  const paginas = Math.max(1, Math.ceil(filtradas.length / tam));
  const pedida = Number.isInteger(consulta.pagina) ? consulta.pagina : 1;
  const pagina = Math.min(Math.max(1, pedida), paginas);

  return {
    linhas: filtradas.slice((pagina - 1) * tam, pagina * tam),
    total: filtradas.length,
    pagina,
    paginas,
    tam,
    contagens,
  };
}

/** O detalhe de uma placa de exemplo (e a própria placa de exemplo), ou `null` se não existe. */
function detalheDe(
  placa: string,
  hoje: string,
  armazem: Armazem,
): { detalhe: DetalheDaPlaca; exemplo: PlacaDeExemplo } | null {
  const todas = armazem.placasParaLista();
  const exemplo = todas.find((p) => p.placa === placa);
  if (!exemplo) return null;
  const [linha] = paraLinhas(todas, hoje).filter((l) => l.id === exemplo.id);
  if (!linha) return null;
  return {
    exemplo,
    detalhe: {
      ...linha,
      ano: exemplo.ano,
      renavam: exemplo.renavam,
      desde: exemplo.desde,
      crs: exemplo.crs.map((cr) => ({ ...cr })),
      crsVigentes: exemplo.crs
        .filter((cr) => cr.inicio <= hoje && (cr.fim === null || hoje < cr.fim))
        .sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0))
        .map((cr) => ({ ...cr })),
    },
  };
}

export const fonteDeExemplo: FonteDePlacas = {
  async consultar(consulta, hoje, opcoes: OpcoesDaConsulta) {
    if (process.env.EIXO_DADOS !== "exemplo") throw new Error(MENSAGEM_SO_COM_EXEMPLO);
    const { lentoMs, falha } = opcoes.simulacao ?? {};
    if (lentoMs && lentoMs > 0) await new Promise((r) => setTimeout(r, Math.min(lentoMs, 10_000)));
    // ?falha=funcao-ausente: a mesma falha de uma migration que não foi aplicada (PGRST202).
    if (falha === "funcao-ausente") {
      throw falhaDeLeitura("listar_placas", {
        code: "PGRST202",
        message: "Could not find the function nucleo.listar_placas in the schema cache",
      });
    }
    if (falha) throw new Error("Falha simulada pela fonte de exemplo.");
    return consultar(consulta, hoje, armazemDoProcesso(hoje, await sessaoDeExemplo()));
  },
  async obter(placa, hoje, opcoes: OpcoesDaConsulta): Promise<DetalheDaPlaca | null> {
    if (process.env.EIXO_DADOS !== "exemplo") throw new Error(MENSAGEM_SO_COM_EXEMPLO);
    const { lentoMs, falhaNoPainel } = opcoes.simulacao ?? {};
    if (lentoMs && lentoMs > 0) await new Promise((r) => setTimeout(r, Math.min(lentoMs, 10_000)));
    if (falhaNoPainel) throw new Error("Falha simulada pela fonte de exemplo, no painel.");
    return (
      detalheDe(placa, hoje, armazemDoProcesso(hoje, await sessaoDeExemplo()))?.detalhe ?? null
    );
  },
  async obterFicha(placa, hoje, opcoes: OpcoesDaConsulta): Promise<FichaDaPlaca | null> {
    if (process.env.EIXO_DADOS !== "exemplo") throw new Error(MENSAGEM_SO_COM_EXEMPLO);
    const { lentoMs, falha } = opcoes.simulacao ?? {};
    if (lentoMs && lentoMs > 0) await new Promise((r) => setTimeout(r, Math.min(lentoMs, 10_000)));
    if (falha) throw new Error("Falha simulada pela fonte de exemplo.");
    const armazem = armazemDoProcesso(hoje, await sessaoDeExemplo());
    const achado = detalheDe(placa, hoje, armazem);
    return achado ? { ...achado.detalhe, eventos: armazem.eventosDaPlaca(placa) } : null;
  },
};

/** A escrita sobre um armazém qualquer (a de verdade usa o do processo; os testes passam o seu). */
export function escritaDoArmazem(armazem: Armazem): FonteDeEscrita {
  return {
    criaveis: ["marca", "modelo", "gestor", "operacao", "cr", "filial"],
    cadastrarPlaca: async (entrada, chave, agora) => armazem.cadastrar(entrada, chave, agora),
    entregarAoOperacional: async (entrada, chave, agora) => armazem.entregar(entrada, chave, agora),
    disponibilizarPlaca: async (entrada, chave, agora) =>
      armazem.disponibilizar(entrada, chave, agora),
    receberPlaca: async (entrada, chave, agora, gestorId) =>
      armazem.receber(entrada, chave, agora, gestorId),
    concluirRecebimento: async (entrada, chave, agora, gestorId) =>
      armazem.concluir(entrada, chave, agora, gestorId),
    mudarSituacao: async (entrada, chave, agora) => armazem.mudarSituacao(entrada, chave, agora),
    engatar: async (entrada, chave, agora) => armazem.engatar(entrada, chave, agora),
    desatrelar: async (entrada, chave, agora) => armazem.desatrelar(entrada, chave, agora),
    corrigirPlaca: async (entrada, chave, agora) => armazem.corrigir(entrada, chave, agora),
    conjuntoDaPlaca: async (placa) => armazem.conjuntoDaPlaca(placa),
    implementosLivres: async () =>
      armazem
        .implementosLivres()
        .map((p) => ({ placa: p.placa, nome: `${p.placa} · ${p.modelo}` }))
        .sort((a, b) => (a.placa < b.placa ? -1 : 1)),
    cavalosParaEngatar: async () =>
      armazem
        .placasParaLista()
        .filter((p) => p.tipo === "cavalo" && !SIGLAS_DE_BAIXA.includes(p.sigla))
        .map((p) => ({ placa: p.placa, nome: `${p.placa} · ${p.modelo}` }))
        .sort((a, b) => (a.placa < b.placa ? -1 : 1)),
    cancelarPedido: async (entrada, chave, agora, gestorId) =>
      armazem.cancelar(entrada, chave, agora, gestorId),
    devolverPlaca: async (entrada, chave, agora, gestorId) =>
      armazem.devolver(entrada, chave, agora, gestorId),
    criarItemDeCatalogo: async (entrada, chave) => armazem.criarItemDeCatalogo(entrada, chave),
    catalogos: async () => armazem.catalogos(),
    placaParaAssistente: async (placa) => armazem.obterPlaca(placa),
    pedidoAbertoDa: async (placa) => armazem.pedidoAbertoDa(placa),
    pedidosParaReceber: async (gestorId) => armazem.pedidosParaReceber(gestorId),
    placasQuePodemSerEntregues: async () =>
      armazem
        .placasParaLista()
        .filter((p) => podeEntregar(p.sigla, p.tipo))
        .map((p) => ({ placa: p.placa, nome: `${p.placa} · ${p.modelo}` }))
        .sort((a, b) => (a.placa < b.placa ? -1 : 1)),
  };
}

export async function escritaDeExemplo(hoje: string): Promise<FonteDeEscrita> {
  if (process.env.EIXO_DADOS !== "exemplo") throw new Error(MENSAGEM_SO_COM_EXEMPLO);
  return escritaDoArmazem(armazemDoProcesso(hoje, await sessaoDeExemplo()));
}

/** Quantas placas esperam pelo gestor do exemplo (o selo, a faixa e o chip). */
export async function contarParaReceberNoExemplo(hoje: string): Promise<number> {
  if (process.env.EIXO_DADOS !== "exemplo") throw new Error(MENSAGEM_SO_COM_EXEMPLO);
  return armazemDoProcesso(hoje, await sessaoDeExemplo()).pedidosParaReceber(GESTOR_DO_EXEMPLO)
    .length;
}

// As telas de painel da Fase 1 (Comparativo, Análise, Resultados, Pessoas): o papel das funções do
// banco que ainda não existem. Só por lib/dados/fonte.ts (porta única do exemplo).
export { gravarPainelDeExemplo, lerPainelDeExemplo } from "@/lib/exemplo/paineis";
