import { textoDoErro } from "@/lib/log/erro";
import {
  podeEntregar,
  type PedidoDeTransferencia,
  type SituacaoDoPedido,
} from "@/lib/dominio/custodia";
import type { TipoDeItemDeCatalogo } from "@/lib/dominio/esquemas/placa";
import { normalizarPlaca } from "@/lib/dominio/placa";
import { SIGLAS, type Sigla } from "@/lib/dominio/status";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import type {
  AtualDaAcao,
  Catalogos,
  ConjuntoDaPlaca,
  ItemCriado,
  PlacaAEscolher,
  PlacaGravada,
} from "./escrita-tipos";
import type { FonteDeEscrita } from "./fonte";
import { TIPOS_DE_ATIVO, type TipoDeAtivo } from "./placas-tipos";

// A escrita pelo banco (fatia 3.9b-1): cada gravação chama uma função atômica do Supabase com a
// sessão de quem usa (a RLS e a permissão ficam no banco), passa a chave de envio (a mesma chave
// devolve o mesmo resultado) e a versão que a pessoa viu (conflito vira "este registro mudou"). O
// erro do banco vira um resultado tipado pelo código do Postgres; nada lança para a tela.

/** O erro como o PostgREST devolve: `code` é o SQLSTATE do Postgres. */
export interface ErroDoBanco {
  message: string;
  code?: string;
}
type Resposta = PromiseLike<{ data: unknown; error: ErroDoBanco | null }>;

/** O pedaço do cliente do Supabase que a escrita usa (nos testes, um simulado com esta forma). */
export interface ClienteDeEscrita {
  schema(esquema: "nucleo" | "config"): {
    rpc(funcao: string, argumentos?: Record<string, unknown>): Resposta;
    from(tabela: string): {
      insert(linha: Record<string, unknown>): { select(colunas: string): { single(): Resposta } };
      update(valores: Record<string, unknown>): {
        eq(coluna: string, valor: string): { select(colunas: string): { single(): Resposta } };
      };
    };
  };
}

type Resultado<T> = ResultadoDaAcao<T, AtualDaAcao>;

/** O "+" no banco: só o que tem caminho seguro (marca e modelo pelas políticas, CR por criar_cr). */
export const CRIAVEIS_NO_BANCO: readonly TipoDeItemDeCatalogo[] = ["marca", "modelo", "cr"];

class FalhaDoBanco extends Error {
  constructor(
    readonly funcao: string,
    readonly erro: ErroDoBanco,
  ) {
    super(`${funcao}: ${erro.message}`);
    this.name = "FalhaDoBanco";
  }
}

/**
 * O erro do banco como resultado tipado: 42501 sem permissão, 40001 conflito de versão, 23505 chave
 * repetida (o cadastro decide se é a placa), e os de regra (23514, 23503, 22xxx, P0001), que já
 * trazem a mensagem em português, viram entrada inválida. O resto é falha.
 */
export function resultadoDoErro<T>(erro: ErroDoBanco): Resultado<T> {
  const codigo = erro.code ?? "";
  if (codigo === "42501")
    return erroDaAcao<AtualDaAcao>("sem_permissao", { mensagem: erro.message });
  if (codigo === "40001") return erroDaAcao<AtualDaAcao>("conflito");
  // 23000 é a chave que não aceita troca; 23P01, a vigência ou o conjunto que se sobrepõe.
  if (
    codigo === "23514" ||
    codigo === "23503" ||
    codigo === "23000" ||
    codigo === "23P01" ||
    codigo === "P0001" ||
    codigo.startsWith("22")
  ) {
    return erroDaAcao<AtualDaAcao>("entrada_invalida", { mensagem: erro.message });
  }
  if (codigo === "23505")
    return erroDaAcao<AtualDaAcao>("entrada_invalida", { mensagem: erro.message });
  console.error("gravação no banco falhou:", textoDoErro(erro));
  return erroDaAcao<AtualDaAcao>("falha");
}

async function chamar<T>(
  c: ClienteDeEscrita,
  funcao: string,
  argumentos: Record<string, unknown> = {},
): Promise<{ ok: true; dados: T } | { ok: false; erro: ErroDoBanco }> {
  const { data, error } = await c.schema("nucleo").rpc(funcao, argumentos);
  return error ? { ok: false, erro: error } : { ok: true, dados: data as T };
}

/** Leitura que não pode falhar calada: erro vira exceção (a ação devolve `falha`). */
async function ler<T>(
  c: ClienteDeEscrita,
  funcao: string,
  argumentos: Record<string, unknown> = {},
) {
  const r = await chamar<T>(c, funcao, argumentos);
  if (!r.ok) throw new FalhaDoBanco(funcao, r.erro);
  return r.dados;
}

// ---------- conversões ----------

interface PlacaDoBanco {
  ativo_id: string;
  placa: string;
  tipo: string;
  renavam: string | null;
  modelo: string;
  modelo_id: string | null;
  marca_id: string | null;
  marca: string | null;
  ano: number | null;
  sigla: string;
  desde: string | null;
  gestor_id: string | null;
  gestor: string | null;
  operacao_id: string | null;
  operacao: string | null;
  cr: string | null;
  filial_id: string | null;
  filial: string | null;
  garagem: string | null;
  versao: number | null;
}

interface PedidoDoBanco {
  id: string;
  placa: string;
  de_gestor_id: string;
  de_gestor: string | null;
  para_gestor_id: string;
  para_gestor: string | null;
  motivo: string;
  situacao: string;
  versao: number;
  pendencias: { id: string; texto: string }[] | null;
}

const SITUACOES: Record<string, SituacaoDoPedido> = {
  pendente: "pendente",
  em_conferencia: "em_conferencia",
  concluida: "concluido",
  devolvida: "devolvido",
  cancelada: "cancelado",
};

export function paraPlacaGravada(p: PlacaDoBanco): PlacaGravada {
  if (!(TIPOS_DE_ATIVO as readonly string[]).includes(p.tipo)) {
    throw new Error(`Tipo de ativo que a tela não conhece: ${p.tipo}`);
  }
  if (!(SIGLAS as readonly string[]).includes(p.sigla)) {
    throw new Error(`Situação que a tela não conhece: ${p.sigla}`);
  }
  return {
    placa: p.placa,
    tipo: p.tipo as TipoDeAtivo,
    renavam: p.renavam ?? "",
    marcaId: p.marca_id,
    marca: p.marca,
    modeloId: p.modelo_id,
    modelo: p.modelo,
    ano: p.ano,
    sigla: p.sigla as Sigla,
    desde: p.desde ?? "",
    gestorId: p.gestor_id,
    gestor: p.gestor ?? "Sem gestor",
    operacaoId: p.operacao_id,
    operacao: p.operacao,
    crId: null,
    crs: [],
    filialId: p.filial_id,
    filial: p.filial ?? "Sem filial",
    garagem: p.garagem ?? "Sem garagem",
    valor: {
      codigoFipe: null,
      valorFipeCentavos: null,
      valorManualCentavos: null,
      fonteDoValor: null,
      dataDoValor: null,
    },
    versao: p.versao ?? 0,
    gestores: [],
  };
}

export function paraPedido(p: PedidoDoBanco): PedidoDeTransferencia {
  const situacao = SITUACOES[p.situacao];
  if (!situacao) throw new Error(`Situação de pedido que a tela não conhece: ${p.situacao}`);
  return {
    id: p.id,
    placa: p.placa,
    deGestorId: p.de_gestor_id,
    deGestor: p.de_gestor ?? "Gestor de origem",
    paraGestorId: p.para_gestor_id,
    paraGestor: p.para_gestor ?? "Gestor de destino",
    motivo: p.motivo,
    pendenciasConhecidas: (p.pendencias ?? []).map(({ id, texto }) => ({ id, texto })),
    situacao,
    versao: p.versao,
  };
}

/** `aaaa-mm-ddThh:mm` de São Paulo como instante com fuso (São Paulo está em -03:00 o ano todo). */
export const instanteDeSaoPaulo = (local: string) => `${local}:00-03:00`;

interface LinhaDeConjunto {
  cavalo: string | null;
  implementos: string[] | null;
}

/** Centavos inteiros para reais (o JSON leva o número mais curto, que o numeric(15,2) lê exato). */
const reaisDeCentavos = (centavos: number) => centavos / 100;

// ---------- a fonte ----------

export function escritaDoBanco(cliente: () => Promise<ClienteDeEscrita>): FonteDeEscrita {
  async function placaDoBanco(c: ClienteDeEscrita, placa: string) {
    return ler<PlacaDoBanco | null>(c, "placa_para_assistente", {
      p_placa: normalizarPlaca(placa),
    });
  }
  async function pedidoDaPlaca(c: ClienteDeEscrita, placa: string) {
    const p = await ler<PedidoDoBanco | null>(c, "pedido_aberto_da_placa", {
      p_placa: normalizarPlaca(placa),
    });
    return p ? paraPedido(p) : null;
  }
  /** O conflito traz o registro como está agora (a placa, ou o pedido). */
  async function comAtual<T>(r: Resultado<T>, atual: () => Promise<AtualDaAcao | null>) {
    if (r.ok || r.erro.codigo !== "conflito") return r;
    const agora = await atual();
    return agora ? erroDaAcao<AtualDaAcao>("conflito", { atual: agora }) : r;
  }

  return {
    criaveis: CRIAVEIS_NO_BANCO,

    async cadastrarPlaca(entrada, chave): Promise<Resultado<PlacaGravada>> {
      const c = await cliente();
      const implemento = entrada.tipo === "implemento" ? entrada : null;
      // Ano e valor vão no próprio cadastro (uma transação): nunca fica a placa sem eles.
      const comFipe = "codigoFipe" in entrada ? entrada : null;
      const comValorManual = "valorManualCentavos" in entrada ? entrada : null;
      const r = await chamar<string>(c, "cadastrar_ativo", {
        p_tipo: entrada.tipo,
        p_renavam: entrada.tipo === "equipamento" ? null : entrada.renavam,
        p_numero_de_serie: entrada.tipo === "equipamento" ? entrada.numeroDeSerie : null,
        p_placa: entrada.placa,
        p_gestor_id: entrada.gestorId,
        p_cr_id: entrada.crId,
        p_operacao_id: entrada.operacaoId,
        p_situacao_inicial: entrada.situacaoInicial,
        p_funcao: implemento?.funcao ?? null,
        p_carroceria_id: implemento?.carroceriaId ?? null,
        p_eixos: implemento?.eixos ?? null,
        p_modelo_id: entrada.modeloId,
        p_chave: chave,
        p_ano_fabricacao: entrada.ano,
        p_codigo_fipe: comFipe?.codigoFipe ?? null,
        p_valor_fipe: comFipe ? reaisDeCentavos(comFipe.valorFipeCentavos) : null,
        p_valor_fipe_referencia: comFipe ? `${new Date().toISOString().slice(0, 7)}-01` : null,
        p_valor_manual: comValorManual ? reaisDeCentavos(comValorManual.valorManualCentavos) : null,
        p_valor_manual_fonte: comValorManual?.fonteDoValor ?? null,
        p_valor_manual_em: comValorManual?.dataDoValor ?? null,
      });
      if (!r.ok) {
        if (r.erro.code === "23505" && !/chave de envio/i.test(r.erro.message)) {
          if (/renavam/i.test(r.erro.message)) {
            return erroDaAcao("entrada_invalida", {
              campos: { renavam: ["Este RENAVAM já está cadastrado em outra placa."] },
            });
          }
          const existente = await placaDoBanco(c, entrada.placa);
          return erroDaAcao<AtualDaAcao>(
            "placa_ja_existe",
            existente ? { atual: paraPlacaGravada(existente) } : {},
          );
        }
        return resultadoDoErro(r.erro);
      }
      const nova = await placaDoBanco(c, entrada.placa);
      if (!nova) throw new Error("A placa cadastrada não voltou na leitura.");
      return sucesso(paraPlacaGravada(nova));
    },

    async entregarAoOperacional(entrada, chave): Promise<Resultado<PlacaGravada>> {
      const c = await cliente();
      const atual = await placaDoBanco(c, entrada.placa);
      if (!atual) return erroDaAcao("nao_encontrado");
      const r = await chamar<string>(c, "entregar_ao_operacional", {
        p_ativo_id: atual.ativo_id,
        p_filial_id: entrada.filialId,
        p_em: new Date().toISOString(),
        p_versao: entrada.versaoDaPlaca,
        p_chave: chave,
      });
      if (!r.ok) {
        return comAtual(resultadoDoErro<PlacaGravada>(r.erro), async () => {
          const agora = await placaDoBanco(c, entrada.placa);
          return agora ? paraPlacaGravada(agora) : null;
        });
      }
      const nova = await placaDoBanco(c, entrada.placa);
      if (!nova) throw new Error("A placa entregue não voltou na leitura.");
      return sucesso(paraPlacaGravada(nova));
    },

    async disponibilizarPlaca(entrada, chave): Promise<Resultado<PedidoDeTransferencia>> {
      const c = await cliente();
      const atual = await placaDoBanco(c, entrada.placa);
      if (!atual) return erroDaAcao("nao_encontrado");
      const r = await chamar<string>(c, "disponibilizar_placa", {
        p_ativo_id: atual.ativo_id,
        p_para_gestor_id: entrada.paraGestorId,
        p_motivo: entrada.motivo,
        p_pendencias: entrada.pendenciasConhecidas,
        p_versao: entrada.versaoDaPlaca,
        p_chave: chave,
      });
      if (!r.ok) {
        return comAtual(resultadoDoErro<PedidoDeTransferencia>(r.erro), async () => {
          const agora = await placaDoBanco(c, entrada.placa);
          return agora ? paraPlacaGravada(agora) : null;
        });
      }
      const pedido = await pedidoDaPlaca(c, entrada.placa);
      if (!pedido) throw new Error("O pedido gravado não voltou na leitura.");
      return sucesso(pedido);
    },

    async receberPlaca(entrada, chave): Promise<Resultado<PedidoDeTransferencia>> {
      const c = await cliente();
      const r = await chamar<string>(c, "receber_placa", {
        p_transferencia_id: entrada.pedidoId,
        p_versao: entrada.versaoDoPedido,
        p_chave: chave,
      });
      if (!r.ok) {
        return comAtual(resultadoDoErro<PedidoDeTransferencia>(r.erro), () =>
          pedidoDaPlaca(c, entrada.placa),
        );
      }
      const pedido = await pedidoDaPlaca(c, entrada.placa);
      if (!pedido) throw new Error("O pedido recebido não voltou na leitura.");
      return sucesso(pedido);
    },

    async concluirRecebimento(entrada, chave): Promise<Resultado<PlacaGravada>> {
      const c = await cliente();
      const r = await chamar<string>(c, "concluir_recebimento", {
        p_transferencia_id: entrada.pedidoId,
        p_versao: entrada.versaoDoPedido,
        p_respostas: entrada.pendencias.map((p) => ({
          id: p.id,
          resolvida: p.resolvida,
          nota: p.nota,
        })),
        p_chave: chave,
      });
      if (!r.ok) {
        return comAtual(resultadoDoErro<PlacaGravada>(r.erro), () =>
          pedidoDaPlaca(c, entrada.placa),
        );
      }
      const nova = await placaDoBanco(c, entrada.placa);
      if (!nova) throw new Error("A placa recebida não voltou na leitura.");
      return sucesso(paraPlacaGravada(nova));
    },

    async mudarSituacao(entrada): Promise<Resultado<PlacaGravada>> {
      const c = await cliente();
      const atual = await placaDoBanco(c, entrada.placa);
      if (!atual) return erroDaAcao("nao_encontrado");
      // O evento é a gravação: o banco confere se a sigla vale para o tipo e para o conjunto.
      const r = await chamar<string>(c, "registrar_evento", {
        p_ativo_id: atual.ativo_id,
        p_sigla: entrada.sigla,
        p_em: instanteDeSaoPaulo(entrada.quando),
        p_origem: "manual",
      });
      if (!r.ok) return resultadoDoErro(r.erro);
      const nova = await placaDoBanco(c, entrada.placa);
      if (!nova) throw new Error("A placa mudada não voltou na leitura.");
      return sucesso(paraPlacaGravada(nova));
    },

    async engatar(entrada): Promise<Resultado<PlacaGravada>> {
      const c = await cliente();
      const cavalo = await placaDoBanco(c, entrada.placa);
      const implemento = await placaDoBanco(c, entrada.implemento);
      if (!cavalo || !implemento) return erroDaAcao("nao_encontrado");
      const r = await chamar<string>(c, "engatar", {
        p_cavalo_id: cavalo.ativo_id,
        p_implemento_id: implemento.ativo_id,
        p_posicao: entrada.posicao,
        p_em: instanteDeSaoPaulo(entrada.quando),
      });
      if (!r.ok) return resultadoDoErro(r.erro);
      const nova = await placaDoBanco(c, entrada.placa);
      if (!nova) throw new Error("O cavalo engatado não voltou na leitura.");
      return sucesso(paraPlacaGravada(nova));
    },

    async desatrelar(entrada): Promise<Resultado<PlacaGravada>> {
      const c = await cliente();
      const cavalo = await placaDoBanco(c, entrada.placa);
      if (!cavalo) return erroDaAcao("nao_encontrado");
      const ids: string[] = [];
      for (const placa of entrada.implementos) {
        const implemento = await placaDoBanco(c, placa);
        if (!implemento) return erroDaAcao("nao_encontrado");
        ids.push(implemento.ativo_id);
      }
      const r = await chamar<number>(c, "desatrelar", {
        p_cavalo_id: cavalo.ativo_id,
        p_em: instanteDeSaoPaulo(entrada.quando),
        p_implementos: ids,
      });
      if (!r.ok) return resultadoDoErro(r.erro);
      const nova = await placaDoBanco(c, entrada.placa);
      if (!nova) throw new Error("O cavalo desatrelado não voltou na leitura.");
      return sucesso(paraPlacaGravada(nova));
    },

    async corrigirPlaca(entrada, chave): Promise<Resultado<PlacaGravada>> {
      const c = await cliente();
      const atual = await placaDoBanco(c, entrada.placa);
      if (!atual) return erroDaAcao("nao_encontrado");
      const comoEsta = () =>
        placaDoBanco(c, entrada.placa).then((p) => (p ? paraPlacaGravada(p) : null));
      if ((atual.versao ?? 0) !== entrada.versaoDaPlaca) {
        return comAtual(erroDaAcao<AtualDaAcao>("conflito"), comoEsta);
      }
      // RENAVAM e série são chaves: o banco só deixa PREENCHER o que falta (cadastro pendente).
      const chaves: Record<string, unknown> = {};
      if (entrada.renavam !== undefined) chaves.renavam = entrada.renavam;
      if (entrada.numeroDeSerie !== undefined) chaves.numero_de_serie = entrada.numeroDeSerie;
      let versao: number | null = entrada.versaoDaPlaca;
      let primeira = true;
      if (Object.keys(chaves).length > 0) {
        const { error } = await c
          .schema("nucleo")
          .from("ativo")
          .update(chaves)
          .eq("id", atual.ativo_id)
          .select("id")
          .single();
        if (error) return resultadoDoErro(error);
        versao = null;
        primeira = false;
      }
      // Eixos e carroceria são campos corrigíveis: a correção guarda o valor, o motivo e o anterior.
      const campos: [string, unknown][] = [];
      if (entrada.eixos !== undefined) campos.push(["eixos", entrada.eixos]);
      if (entrada.carroceriaId !== undefined) campos.push(["carroceria_id", entrada.carroceriaId]);
      for (const [campo, valor] of campos) {
        const r = await chamar<string>(c, "corrigir_campo", {
          p_ativo_id: atual.ativo_id,
          p_campo: campo,
          p_valor: valor,
          p_motivo: entrada.motivo,
          // A chave de envio vale para a primeira gravação do envio; as outras repetem sem dano.
          p_chave: primeira ? chave : null,
          p_versao: versao,
        });
        if (!r.ok) return comAtual(resultadoDoErro<PlacaGravada>(r.erro), comoEsta);
        versao = null;
        primeira = false;
      }
      const nova = await placaDoBanco(c, entrada.placa);
      if (!nova) throw new Error("A placa corrigida não voltou na leitura.");
      return sucesso(paraPlacaGravada(nova));
    },

    async conjuntoDaPlaca(placa): Promise<ConjuntoDaPlaca | null> {
      const c = await cliente();
      const d = await ler<LinhaDeConjunto | null>(c, "detalhe_da_placa", {
        p_placa: normalizarPlaca(placa),
      });
      if (!d) return null;
      const implementos = d.implementos ?? [];
      const cavalo = d.cavalo ?? (implementos.length > 0 ? normalizarPlaca(placa) : null);
      if (cavalo === null) return null;
      // O nome sai da nomenclatura no banco (carroceria × configuração); sem ele, a ficha diz isso.
      const doCavalo = await placaDoBanco(c, cavalo);
      const nome = doCavalo
        ? await ler<string | null>(c, "nome_do_conjunto", { p_cavalo_id: doCavalo.ativo_id })
        : null;
      const lista =
        d.cavalo === null
          ? implementos
          : ((await ler<LinhaDeConjunto | null>(c, "detalhe_da_placa", { p_placa: cavalo }))
              ?.implementos ?? []);
      return { cavalo, implementos: lista, nome };
    },

    async implementosLivres(): Promise<PlacaAEscolher[]> {
      const c = await cliente();
      const pagina = await ler<{
        linhas: {
          placa: string;
          modelo: string;
          sigla: string;
          cavalo: string | null;
        }[];
      }>(c, "listar_placas", {
        p_busca: "",
        p_grupos: [],
        p_tipos: ["implemento"],
        p_siglas: [],
        p_baixadas: false,
        p_ordem: "placa",
        p_decrescente: false,
        p_pagina: 1,
        p_tam: 100,
        p_para_receber: false,
      });
      return pagina.linhas
        .filter((l) => l.cavalo === null && !["ALU", "EMP", "VEN"].includes(l.sigla))
        .map((l) => ({ placa: l.placa, nome: `${l.placa} · ${l.modelo}` }));
    },

    async cavalosParaEngatar(): Promise<PlacaAEscolher[]> {
      const c = await cliente();
      // A primeira página basta para escolher (100 cavalos, em ordem de placa); a RLS já limita ao escopo.
      const pagina = await ler<{ linhas: { placa: string; modelo: string }[] }>(
        c,
        "listar_placas",
        {
          p_busca: "",
          p_grupos: [],
          p_tipos: ["cavalo"],
          p_siglas: [],
          p_baixadas: false,
          p_ordem: "placa",
          p_decrescente: false,
          p_pagina: 1,
          p_tam: 100,
          p_para_receber: false,
        },
      );
      return pagina.linhas.map((l) => ({ placa: l.placa, nome: `${l.placa} · ${l.modelo}` }));
    },

    async cancelarPedido(entrada, chave): Promise<Resultado<PedidoDeTransferencia>> {
      const c = await cliente();
      const antes = await pedidoDaPlaca(c, entrada.placa);
      const r = await chamar<string>(c, "cancelar_pedido", {
        p_transferencia_id: entrada.pedidoId,
        p_versao: entrada.versaoDoPedido,
        p_chave: chave,
      });
      if (!r.ok) {
        return comAtual(resultadoDoErro<PedidoDeTransferencia>(r.erro), () =>
          pedidoDaPlaca(c, entrada.placa),
        );
      }
      // Cancelado, o pedido deixa de ser aberto e some da leitura: devolve o que se viu, encerrado.
      if (!antes) throw new Error("O pedido cancelado não estava na leitura.");
      return sucesso({ ...antes, situacao: "cancelado", versao: antes.versao + 1 });
    },

    async devolverPlaca(entrada, chave): Promise<Resultado<PedidoDeTransferencia>> {
      const c = await cliente();
      const antes = await pedidoDaPlaca(c, entrada.placa);
      const r = await chamar<string>(c, "devolver_placa", {
        p_transferencia_id: entrada.pedidoId,
        p_versao: entrada.versaoDoPedido,
        p_motivo: entrada.motivo,
        p_chave: chave,
      });
      if (!r.ok) {
        return comAtual(resultadoDoErro<PedidoDeTransferencia>(r.erro), () =>
          pedidoDaPlaca(c, entrada.placa),
        );
      }
      // Devolvido, o destino deixa de ver a placa: devolve o que se viu, encerrado.
      if (!antes) throw new Error("O pedido devolvido não estava na leitura.");
      return sucesso({ ...antes, situacao: "devolvido", versao: antes.versao + 1 });
    },

    async criarItemDeCatalogo(entrada, chave): Promise<Resultado<ItemCriado>> {
      const c = await cliente();
      if (entrada.tipo === "cr") {
        const r = await chamar<string>(c, "criar_cr", {
          p_codcencus: entrada.codcencus,
          p_codigo: entrada.nome,
          p_nome: entrada.nome,
          p_chave: chave,
        });
        if (!r.ok) {
          if (r.erro.code === "23505" && !/chave de envio/i.test(r.erro.message)) {
            return erroDaAcao("entrada_invalida", {
              campos: {
                nome: ["Já existe um CR com este código ou CODCENCUS. Escolha o que já existe."],
              },
            });
          }
          return resultadoDoErro(r.erro);
        }
        return sucesso({
          tipo: "cr",
          id: r.dados,
          nome: entrada.nome,
          ...(entrada.paiId ? { paiId: entrada.paiId } : {}),
        });
      }
      if (entrada.tipo === "marca" || entrada.tipo === "modelo") {
        // Marca e modelo pelas políticas de Cadastros; o nome único no banco impede a duplicata.
        const linha =
          entrada.tipo === "marca"
            ? { nome: entrada.nome }
            : { nome: entrada.nome, marca_id: entrada.paiId };
        const { data, error } = await c
          .schema("config")
          .from(entrada.tipo)
          .insert(linha)
          .select("id, nome")
          .single();
        if (error) {
          if (error.code === "23505") {
            return erroDaAcao("entrada_invalida", {
              campos: { nome: ["Já existe um cadastro com este nome. Escolha o que já existe."] },
            });
          }
          return resultadoDoErro(error);
        }
        const criado = data as { id: string; nome: string };
        return sucesso({
          tipo: entrada.tipo,
          id: criado.id,
          nome: criado.nome,
          ...(entrada.tipo === "modelo" ? { paiId: entrada.paiId } : {}),
        });
      }
      return erroDaAcao("entrada_invalida", {
        mensagem:
          entrada.tipo === "operacao"
            ? "Operação nova se cria no módulo Operações. Escolha uma da lista."
            : entrada.tipo === "gestor"
              ? "Gestor de frota novo é uma pessoa com o papel de gestor: peça a quem administra o acesso."
              : "As filiais são as 3 garagens. Escolha uma da lista.",
      });
    },

    async catalogos(): Promise<Catalogos> {
      const c = await cliente();
      const d = await ler<{
        marcas: { id: string; nome: string }[];
        modelos: { id: string; nome: string; marca_id: string }[];
        carrocerias: { id: string; nome: string }[];
        gestores: { id: string; nome: string }[];
        operacoes: { id: string; nome: string }[];
        crs: { id: string; codigo: string; operacao_id: string | null }[];
        filiais: { id: string; nome: string }[];
      }>(c, "catalogos_dos_assistentes");
      return {
        marcas: d.marcas.map(({ id, nome }) => ({ id, nome })),
        modelos: d.modelos.map(({ id, nome, marca_id }) => ({ id, nome, marcaId: marca_id })),
        carrocerias: d.carrocerias.map(({ id, nome }) => ({ id, nome })),
        gestores: d.gestores.map(({ id, nome }) => ({ id, nome })),
        operacoes: d.operacoes.map(({ id, nome }) => ({ id, nome })),
        crs: d.crs.map(({ id, codigo, operacao_id }) => ({ id, codigo, operacaoId: operacao_id })),
        filiais: d.filiais.map(({ id, nome }) => ({ id, nome })),
      };
    },

    async placaParaAssistente(placa) {
      const p = await placaDoBanco(await cliente(), placa);
      return p ? paraPlacaGravada(p) : null;
    },

    async pedidoAbertoDa(placa) {
      return pedidoDaPlaca(await cliente(), placa);
    },

    async pedidosParaReceber() {
      const lista = await ler<PedidoDoBanco[]>(await cliente(), "pedidos_para_receber");
      return (lista ?? []).map(paraPedido);
    },

    async placasQuePodemSerEntregues(): Promise<PlacaAEscolher[]> {
      const c = await cliente();
      // Todas as placas que podem ir ao Operacional, página a página (sem parar nas primeiras 100).
      const TAM = 100;
      const linhas: { placa: string; modelo: string; tipo: string; sigla: string }[] = [];
      for (let pagina = 1; ; pagina++) {
        const lida = await ler<{
          linhas: { placa: string; modelo: string; tipo: string; sigla: string }[];
        }>(c, "listar_placas", {
          p_busca: "",
          p_grupos: [],
          p_tipos: ["cavalo", "caminhao"],
          p_siglas: ["PÁT", "ETv"],
          p_baixadas: false,
          p_ordem: "placa",
          p_decrescente: false,
          p_pagina: pagina,
          p_tam: TAM,
          p_para_receber: false,
        });
        linhas.push(...lida.linhas);
        if (lida.linhas.length < TAM) break;
      }
      return linhas
        .filter((l) => podeEntregar(l.sigla as Sigla, l.tipo as TipoDeAtivo))
        .map((l) => ({ placa: l.placa, nome: `${l.placa} · ${l.modelo}` }));
    },
  };
}

/** Quantos pedidos esperam por quem usa (o selo do menu, a faixa e o chip). Falha conta zero. */
export async function contarParaReceberNoBanco(c: ClienteDeEscrita): Promise<number> {
  const r = await chamar<number>(c, "contar_para_receber");
  if (!r.ok) {
    console.error("contar_para_receber falhou:", textoDoErro(r.erro));
    return 0;
  }
  return Number(r.dados) || 0;
}
