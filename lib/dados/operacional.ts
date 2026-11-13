import { falhaDeLeitura } from "@/lib/erros/leitura";
import type {
  EntradaAvancarNoPatio,
  EntradaCriarOrdem,
  EntradaRegistrarChegada,
} from "@/lib/dominio/esquemas/operacional";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ErroDoBanco, resultadoDoErro } from "./escrita-do-banco";
import type {
  ChegadaRegistrada,
  FiltroDasOrdens,
  FiltroDoPatio,
  ListaDeOrdens,
  OperacaoAEscolher,
  OrdemCriada,
  PatioDaFilial,
  PlacaAvancada,
  SituacaoDaOrdem,
} from "./operacional-tipos";

// A leitura e a escrita do Operacional (primeira versão): só o banco, com a sessão de quem usa (a RLS
// e o escopo por filial decidem o que cada perfil vê). Quem filtra, pagina, ordena e conta é o banco
// (nucleo.patio_da_filial e nucleo.ordens_de_carregamento); aqui só se converte o formato. A escrita
// devolve sempre a linha ou um erro tipado.

interface Resposta {
  data: unknown;
  error: ErroDoBanco | null;
}

/** O pedaço do cliente do Supabase que esta leitura usa (nos testes, um simulado com esta forma). */
export interface ClienteDoOperacional {
  schema(esquema: "nucleo"): {
    rpc(funcao: string, argumentos?: Record<string, unknown>): PromiseLike<Resposta>;
    from(tabela: string): {
      select(colunas: string): {
        is(
          coluna: string,
          valor: null,
        ): {
          order(coluna: string): {
            order(coluna: string): PromiseLike<Resposta>;
          };
        };
      };
    };
  };
}

async function clienteDaSessao(): Promise<ClienteDoOperacional> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDoOperacional;
}

async function ler<T>(
  c: ClienteDoOperacional,
  funcao: string,
  argumentos: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await c.schema("nucleo").rpc(funcao, argumentos);
  if (error) throw falhaDeLeitura(funcao, error);
  return data as T;
}

// ---------- Leitura ----------

interface PlacaDoPatioDoBanco {
  ativo_id: string;
  placa: string;
  tipo: string;
  modelo: string;
  implementos: string[] | null;
  sigla: string;
  nome_da_situacao: string | null;
  grupo: string | null;
  filial: string;
  desde: string | null;
  chegou_em: string | null;
  posicao: number | null;
  ordem_numero: number | null;
  ordem_destino: string | null;
  ordem_operacao: string | null;
  ordem_data: string | null;
}

export async function lerPatio(
  filtros: { filtro: FiltroDoPatio; pagina: number; tam: number },
  cliente: () => Promise<ClienteDoOperacional> = clienteDaSessao,
): Promise<PatioDaFilial> {
  const c = await cliente();
  const d = await ler<{
    linhas: PlacaDoPatioDoBanco[];
    contagens: Record<FiltroDoPatio, number>;
    total: number;
    pagina: number;
    paginas: number;
  }>(c, "patio_da_filial", {
    p_situacao: filtros.filtro,
    p_pagina: filtros.pagina,
    p_tam: filtros.tam,
  });
  return {
    linhas: d.linhas.map((l) => ({
      ativoId: l.ativo_id,
      placa: l.placa,
      tipo: l.tipo,
      modelo: l.modelo,
      implementos: l.implementos ?? [],
      sigla: l.sigla,
      nomeDaSituacao: l.nome_da_situacao,
      grupo: l.grupo,
      filial: l.filial,
      desde: l.desde,
      chegouEm: l.chegou_em,
      posicao: l.posicao,
      ordemNumero: l.ordem_numero,
      ordemDestino: l.ordem_destino,
      ordemOperacao: l.ordem_operacao,
      ordemData: l.ordem_data,
    })),
    contagens: d.contagens,
    total: d.total,
    pagina: d.pagina,
    paginas: d.paginas,
  };
}

interface OrdemDoBanco {
  ordem_id: string;
  numero: number;
  ativo_id: string;
  placa: string;
  filial: string;
  operacao: string | null;
  destino: string;
  data_prevista: string;
  situacao: SituacaoDaOrdem;
  criada_em: string;
  carregada_em: string | null;
  saiu_em: string | null;
}

export async function lerOrdens(
  filtros: { filtro: FiltroDasOrdens; pagina: number; tam: number },
  cliente: () => Promise<ClienteDoOperacional> = clienteDaSessao,
): Promise<ListaDeOrdens> {
  const c = await cliente();
  const d = await ler<{
    linhas: OrdemDoBanco[];
    contagens: Record<FiltroDasOrdens, number>;
    total: number;
    pagina: number;
    paginas: number;
  }>(c, "ordens_de_carregamento", {
    p_situacao: filtros.filtro,
    p_pagina: filtros.pagina,
    p_tam: filtros.tam,
  });
  return {
    linhas: d.linhas.map((o) => ({
      ordemId: o.ordem_id,
      numero: o.numero,
      ativoId: o.ativo_id,
      placa: o.placa,
      filial: o.filial,
      operacao: o.operacao,
      destino: o.destino,
      dataPrevista: o.data_prevista,
      situacao: o.situacao,
      criadaEm: o.criada_em,
      carregadaEm: o.carregada_em,
      saiuEm: o.saiu_em,
    })),
    contagens: d.contagens,
    total: d.total,
    pagina: d.pagina,
    paginas: d.paginas,
  };
}

export interface KpisDoOperacional {
  noPatio: number;
  naFila: number;
  maiorEsperaMin: number | null;
  tempoMedioNoPatioMin: number | null;
  ordensAbertas: number;
  ordensCriadasHoje: number;
  ordensEmViagemHoje: number;
}

/** Os KPIs do Pátio, do Totem e das Ordens, prontos no banco (nucleo.kpis_do_operacional). */
export async function lerKpisDoOperacional(
  cliente: () => Promise<ClienteDoOperacional> = clienteDaSessao,
): Promise<KpisDoOperacional> {
  const c = await cliente();
  const d = await ler<{
    no_patio: number;
    na_fila: number;
    maior_espera_min: number | null;
    tempo_medio_no_patio_min: number | null;
    ordens_abertas: number;
    ordens_criadas_hoje: number;
    ordens_em_viagem_hoje: number;
  }>(c, "kpis_do_operacional", {});
  return {
    noPatio: Number(d.no_patio),
    naFila: Number(d.na_fila),
    maiorEsperaMin: d.maior_espera_min === null ? null : Number(d.maior_espera_min),
    tempoMedioNoPatioMin:
      d.tempo_medio_no_patio_min === null ? null : Number(d.tempo_medio_no_patio_min),
    ordensAbertas: Number(d.ordens_abertas),
    ordensCriadasHoje: Number(d.ordens_criadas_hoje),
    ordensEmViagemHoje: Number(d.ordens_em_viagem_hoje),
  };
}

/** As operações para o assistente "Criar ordem" (as não excluídas, pelo nome; desempate pelo id). */
export async function lerOperacoes(
  cliente: () => Promise<ClienteDoOperacional> = clienteDaSessao,
): Promise<OperacaoAEscolher[]> {
  const c = await cliente();
  const { data, error } = await c
    .schema("nucleo")
    .from("operacao")
    .select("id, nome")
    .is("excluido_em", null)
    .order("nome")
    .order("id");
  if (error) throw falhaDeLeitura("operacao", error);
  return (data as OperacaoAEscolher[] | null) ?? [];
}

// ---------- Escrita ----------

export async function gravarChegada(
  entrada: EntradaRegistrarChegada,
  chave: string,
  cliente: () => Promise<ClienteDoOperacional> = clienteDaSessao,
): Promise<ResultadoDaAcao<ChegadaRegistrada>> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("registrar_chegada", {
    p_placa: entrada.placa,
    p_chave: chave,
  });
  if (error) return resultadoDoErro<ChegadaRegistrada>(error);
  const r = data as {
    placa: string;
    filial: string;
    posicao: number | null;
    chegou_em: string;
    ja_estava: boolean;
  } | null;
  if (!r) return erroDaAcao("falha");
  return sucesso({
    placa: r.placa,
    filial: r.filial,
    posicao: r.posicao,
    chegouEm: r.chegou_em,
    jaEstava: r.ja_estava,
  });
}

export async function gravarAvancoNoPatio(
  entrada: EntradaAvancarNoPatio,
  chave: string,
  cliente: () => Promise<ClienteDoOperacional> = clienteDaSessao,
): Promise<ResultadoDaAcao<PlacaAvancada>> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("avancar_no_patio", {
    p_ativo_id: entrada.ativoId,
    p_acao: entrada.acao,
    p_motivo: entrada.acao === "devolver" ? entrada.motivo.trim() : null,
    p_chave: chave,
  });
  if (error) return resultadoDoErro<PlacaAvancada>(error);
  const r = data as { sigla: string | null } | null;
  if (!r) return erroDaAcao("falha");
  return sucesso({ ativoId: entrada.ativoId, placa: entrada.placa, sigla: r.sigla });
}

/**
 * Avança várias placas de uma vez pela função do lote (tudo ou nada: com uma recusa, nenhuma avança e o
 * banco devolve cada recusada com o motivo). Uma chave de envio para o lote inteiro.
 */
export async function gravarAvancoEmLote(
  acao: "aceitar" | "concluir" | "liberar",
  ativos: string[],
  chave: string,
  cliente: () => Promise<ClienteDoOperacional> = clienteDaSessao,
): Promise<
  ResultadoDaAcao<{
    total: number;
    avancados: number;
    recusados: { ativoId: string; motivo: string }[];
  }>
> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("avancar_no_patio_em_lote", {
    p_ativos: ativos,
    p_acao: acao,
    p_motivo: null,
    p_chave: chave,
  });
  if (error) return resultadoDoErro(error);
  const r = data as {
    total: number;
    avancados: number | null;
    recusados: { ativo_id: string; motivo: string }[];
    repetido: boolean;
  } | null;
  if (!r) return erroDaAcao("falha");
  return sucesso({
    total: r.total,
    // Envio repetido: o lote já foi gravado inteiro antes.
    avancados: r.repetido ? r.total : (r.avancados ?? 0),
    recusados: r.recusados.map((x) => ({ ativoId: x.ativo_id, motivo: x.motivo })),
  });
}

export async function gravarOrdem(
  entrada: EntradaCriarOrdem,
  chave: string,
  cliente: () => Promise<ClienteDoOperacional> = clienteDaSessao,
): Promise<ResultadoDaAcao<OrdemCriada>> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("criar_ordem_de_carregamento", {
    p_ativo_id: entrada.ativoId,
    p_operacao_id: entrada.operacaoId,
    p_destino: entrada.destino,
    p_data_prevista: entrada.dataPrevista,
    p_chave: chave,
  });
  if (error) return resultadoDoErro<OrdemCriada>(error);
  const r = data as { ordem_id: string; numero: number; placa: string } | null;
  if (!r) return erroDaAcao("falha");
  return sucesso({ ordemId: r.ordem_id, numero: r.numero, placa: r.placa });
}
