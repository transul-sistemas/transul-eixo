import type { NumerosDeTarefas } from "@/lib/dominio/tarefas";
import type { ErroDoBanco } from "./escrita-do-banco";

// Início › Tarefas e a fila de exceções (Frota › Exceções): só o banco, com a sessão de quem usa. Quem
// conta e quem decide o que a pessoa vê é o banco (nucleo.tarefas_do_usuario e nucleo.excecoes_abertas,
// com a RLS); aqui só se converte o formato.

interface Resposta {
  data: unknown;
  error: ErroDoBanco | null;
}

/** O pedaço do cliente do Supabase que esta leitura usa (nos testes, um simulado com esta forma). */
export interface ClienteDasTarefas {
  schema(esquema: "nucleo"): {
    rpc(funcao: string, argumentos?: Record<string, unknown>): PromiseLike<Resposta>;
  };
}

async function clienteDaSessao(): Promise<ClienteDasTarefas> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDasTarefas;
}

type Bruto = Record<string, unknown>;

export async function lerTarefas(
  cliente: () => Promise<ClienteDasTarefas> = clienteDaSessao,
): Promise<NumerosDeTarefas> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("tarefas_do_usuario");
  if (error) throw new Error(`tarefas_do_usuario: ${error.message}`);
  const d = data as Bruto;
  const excecoes = d.excecoes as { total: number; por_assunto: { assunto: string; n: number }[] };
  return {
    paraReceber: Number(d.para_receber),
    pedidosAbertos: Number(d.pedidos_abertos),
    excecoes: {
      total: Number(excecoes.total),
      porAssunto: excecoes.por_assunto.map((x) => ({ assunto: x.assunto, n: Number(x.n) })),
    },
    placasComAlerta: Number(d.placas_com_alerta),
    alertas: (d.alertas as { alerta: string; n: number }[]).map((x) => ({
      alerta: x.alerta,
      n: Number(x.n),
    })),
  };
}

export interface LinhaDeExcecao {
  id: string;
  assunto: string;
  descricao: string;
  /** ISO com fuso. */
  criadoEm: string;
  ativoId: string | null;
  placa: string | null;
  tipoDoAtivo: string | null;
  /** Falta o RENAVAM (é o que o assistente "Corrigir placa" completa). */
  semRenavam: boolean;
  pessoaId: string | null;
  pessoaNome: string | null;
  cr: string | null;
}

export interface ExcecoesAbertas {
  pagina: number;
  tamanho: number;
  total: number;
  tipos: { assunto: string; n: number }[];
  linhas: LinhaDeExcecao[];
}

export async function lerExcecoes(
  estado: { assunto: string | null; pagina: number },
  cliente: () => Promise<ClienteDasTarefas> = clienteDaSessao,
): Promise<ExcecoesAbertas> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("excecoes_abertas", {
    p_assunto: estado.assunto,
    p_pagina: estado.pagina,
    p_tamanho: TAMANHO_DA_FILA,
  });
  if (error) throw new Error(`excecoes_abertas: ${error.message}`);
  const d = data as Bruto;
  return {
    pagina: Number(d.pagina),
    tamanho: Number(d.tamanho),
    total: Number(d.total),
    tipos: (d.tipos as { assunto: string; n: number }[]).map((t) => ({
      assunto: t.assunto,
      n: Number(t.n),
    })),
    linhas: (d.linhas as Bruto[]).map((l) => ({
      id: String(l.id),
      assunto: String(l.assunto),
      descricao: String(l.descricao),
      criadoEm: String(l.criado_em),
      ativoId: (l.ativo_id as string | null) ?? null,
      placa: (l.placa as string | null) ?? null,
      tipoDoAtivo: (l.tipo_do_ativo as string | null) ?? null,
      semRenavam: l.cavalo_sem_renavam === true,
      pessoaId: (l.pessoa_id as string | null) ?? null,
      pessoaNome: (l.pessoa_nome as string | null) ?? null,
      cr: (l.cr as string | null) ?? null,
    })),
  };
}

export const TAMANHO_DA_FILA = 50;
