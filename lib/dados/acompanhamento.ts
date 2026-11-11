import { falhaDeLeitura } from "@/lib/erros/leitura";
import { textoDoErro } from "@/lib/log/erro";
import type {
  EntradaConfirmarCarteira,
  EntradaLancarSituacao,
} from "@/lib/dominio/esquemas/acompanhamento";
import type {
  Agrupamento,
  EstadoDaCarteira,
  FiltroDaCarteira,
} from "@/lib/navegacao/acompanhamento";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ErroDoBanco, resultadoDoErro } from "./escrita-do-banco";
import type {
  CarteiraConfirmada,
  CarteiraDoMes,
  CelulaDaGrade,
  GradeDoMes,
  LinhaDoAgora,
  LinhaDoCenso,
  SituacaoLancada,
} from "./acompanhamento-tipos";
import type { TipoDeAtivo } from "./placas-tipos";

export type {
  CelulaDaGrade,
  LinhaDaGrade,
  GradeDoMes,
  LinhaDoAgora,
  LinhaDoCenso,
  PlacaDaCarteira,
  CarteiraDoMes,
  SituacaoLancada,
  CarteiraConfirmada,
} from "./acompanhamento-tipos";

// A leitura e a escrita do Acompanhamento e da Carteira (primeira versão): só o banco, com a sessão
// de quem usa (a RLS decide o que cada perfil vê). Quem filtra, pagina, ordena e soma é o banco
// (nucleo.grade_do_acompanhamento, agora_do_acompanhamento, censo_do_acompanhamento, carteira_do_mes);
// aqui só se converte o formato. A escrita devolve sempre a linha ou um erro tipado.

interface Resposta {
  data: unknown;
  error: ErroDoBanco | null;
}

/** O pedaço do cliente do Supabase que esta leitura usa (nos testes, um simulado com esta forma). */
export interface ClienteDoAcompanhamento {
  schema(esquema: "nucleo"): {
    rpc(funcao: string, argumentos?: Record<string, unknown>): PromiseLike<Resposta>;
  };
}

async function clienteDaSessao(): Promise<ClienteDoAcompanhamento> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDoAcompanhamento;
}

async function ler<T>(
  c: ClienteDoAcompanhamento,
  funcao: string,
  argumentos: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await c.schema("nucleo").rpc(funcao, argumentos);
  if (error) throw falhaDeLeitura(funcao, error);
  return data as T;
}

/** Antes de ler a linha mantida, recalcula as que venceram (plano B do recálculo, 3.9a). */
async function atualizarVencidas(c: ClienteDoAcompanhamento): Promise<void> {
  const { error } = await c.schema("nucleo").rpc("atualizar_leitura_vencida");
  if (error) console.error("atualizar_leitura_vencida falhou:", textoDoErro(error));
}

// ---------- Grade ----------

interface LinhaDaGradeDoBanco {
  ativo_id: string;
  placa: string;
  tipo: TipoDeAtivo;
  modelo: string;
  operacao: string | null;
  gestor: string | null;
  em_conjunto: boolean;
  dias: CelulaDaGrade[];
}

export async function lerGrade(
  filtros: { mes: string; busca: string; tipo: TipoDeAtivo | null; pagina: number; tam: number },
  cliente: () => Promise<ClienteDoAcompanhamento> = clienteDaSessao,
): Promise<GradeDoMes> {
  const c = await cliente();
  const g = await ler<Omit<GradeDoMes, "linhas"> & { linhas: LinhaDaGradeDoBanco[] }>(
    c,
    "grade_do_acompanhamento",
    {
      p_mes: `${filtros.mes}-01`,
      p_busca: filtros.busca,
      p_tipos: filtros.tipo ? [filtros.tipo] : [],
      p_pagina: filtros.pagina,
      p_tam: filtros.tam,
    },
  );
  return {
    ...g,
    linhas: g.linhas.map((l) => ({
      ativoId: l.ativo_id,
      placa: l.placa,
      tipo: l.tipo,
      modelo: l.modelo,
      operacao: l.operacao,
      gestor: l.gestor,
      emConjunto: l.em_conjunto,
      dias: l.dias,
    })),
  };
}

// ---------- Agora ----------

export async function lerAgora(
  agrupamento: Agrupamento,
  tipo: TipoDeAtivo | null,
  cliente: () => Promise<ClienteDoAcompanhamento> = clienteDaSessao,
): Promise<{ grupos: LinhaDoAgora[]; total: LinhaDoAgora }> {
  const c = await cliente();
  await atualizarVencidas(c);
  const linhas = await ler<
    {
      chave: string | null;
      rotulo: string;
      total: number;
      em_atividade: number;
      atencao: number;
      impedida: number;
      patio: number;
      fora: number;
      pendente: number;
    }[]
  >(c, "agora_do_acompanhamento", { p_agrupamento: agrupamento, p_tipos: tipo ? [tipo] : [] });
  const convertidas = linhas.map((l) => ({
    chave: l.chave,
    rotulo: l.rotulo,
    total: Number(l.total),
    emAtividade: Number(l.em_atividade),
    atencao: Number(l.atencao),
    impedida: Number(l.impedida),
    patio: Number(l.patio),
    fora: Number(l.fora),
    pendente: Number(l.pendente),
  }));
  // O banco devolve a linha de total sempre por último.
  const total = convertidas.at(-1);
  if (!total) throw new Error("agora_do_acompanhamento: sem a linha de total");
  return { grupos: convertidas.slice(0, -1), total };
}

// ---------- Censo ----------

export async function lerCenso(
  dia: string,
  tipo: TipoDeAtivo | null,
  cliente: () => Promise<ClienteDoAcompanhamento> = clienteDaSessao,
): Promise<{ linhas: LinhaDoCenso[]; total: number }> {
  const c = await cliente();
  await atualizarVencidas(c);
  const linhas = await ler<
    { sigla: string | null; nome: string | null; grupo: string | null; quantidade: number }[]
  >(c, "censo_do_acompanhamento", { p_dia: dia, p_tipos: tipo ? [tipo] : [] });
  const total = Number(linhas.find((l) => l.sigla === null)?.quantidade ?? 0);
  return {
    linhas: linhas
      .filter((l) => l.sigla !== null)
      .map((l) => ({
        sigla: l.sigla as string,
        nome: l.nome ?? (l.sigla as string),
        grupo: l.grupo ?? "fora",
        quantidade: Number(l.quantidade),
      })),
    total,
  };
}

// ---------- Carteira ----------

export async function lerCarteiraDoMes(
  estado: EstadoDaCarteira,
  cliente: () => Promise<ClienteDoAcompanhamento> = clienteDaSessao,
): Promise<CarteiraDoMes> {
  const c = await cliente();
  await atualizarVencidas(c);
  const d = await ler<{
    mes: string;
    gestor: boolean;
    linhas: {
      ativo_id: string;
      placa: string;
      tipo: TipoDeAtivo;
      modelo: string;
      sigla: string;
      grupo: string | null;
      nome_da_situacao: string | null;
      confere: boolean | null;
      observacao: string | null;
      confirmado_em: string | null;
    }[];
    total: number;
    conferem: number;
    nao_conferem: number;
    pendentes: number;
    filtradas: number;
    pagina: number;
    paginas: number;
    tam: number;
  }>(c, "carteira_do_mes", {
    p_mes: `${estado.mes}-01`,
    p_filtro: estado.filtro satisfies FiltroDaCarteira,
    p_pagina: estado.pagina,
    p_tam: estado.tam,
  });
  return {
    mes: d.mes,
    gestor: d.gestor,
    linhas: d.linhas.map((l) => ({
      ativoId: l.ativo_id,
      placa: l.placa,
      tipo: l.tipo,
      modelo: l.modelo,
      sigla: l.sigla,
      grupo: l.grupo,
      nomeDaSituacao: l.nome_da_situacao,
      confere: l.confere,
      observacao: l.observacao,
      confirmadoEm: l.confirmado_em,
    })),
    total: d.total,
    conferem: d.conferem,
    naoConferem: d.nao_conferem,
    pendentes: d.pendentes,
    filtradas: d.filtradas,
    pagina: d.pagina,
    paginas: d.paginas,
    tam: d.tam,
  };
}

// ---------- Escrita ----------

export async function gravarSituacaoDoDia(
  entrada: EntradaLancarSituacao,
  chave: string,
  cliente: () => Promise<ClienteDoAcompanhamento> = clienteDaSessao,
): Promise<ResultadoDaAcao<SituacaoLancada>> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("lancar_situacao_do_dia", {
    p_ativo_id: entrada.ativoId,
    p_sigla: entrada.sigla,
    p_dia: entrada.dia,
    p_chave: chave,
  });
  if (error) return resultadoDoErro<SituacaoLancada>(error);
  const linha = data as { sigla: string | null } | null;
  if (!linha) return erroDaAcao("falha");
  return sucesso({
    ativoId: entrada.ativoId,
    placa: entrada.placa,
    dia: entrada.dia,
    sigla: linha.sigla ?? entrada.sigla,
  });
}

export async function gravarConfirmacaoDaCarteira(
  entrada: EntradaConfirmarCarteira,
  chave: string,
  cliente: () => Promise<ClienteDoAcompanhamento> = clienteDaSessao,
): Promise<ResultadoDaAcao<CarteiraConfirmada>> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("confirmar_carteira", {
    p_mes: `${entrada.mes}-01`,
    p_itens: entrada.itens.map((i) => ({
      ativo_id: i.ativoId,
      confere: i.confere,
      observacao: i.confere ? null : i.observacao.trim(),
    })),
    p_chave: chave,
  });
  if (error) return resultadoDoErro<CarteiraConfirmada>(error);
  const r = data as { gravadas: number; pedidas: number; repetido: boolean } | null;
  if (!r) return erroDaAcao("falha");
  // O envio repetido (mesma chave) já tinha gravado tudo da primeira vez.
  return sucesso({
    mes: entrada.mes,
    gravadas: r.repetido ? r.pedidas : r.gravadas,
    pedidas: r.pedidas,
  });
}
