"use server";

import { lerNoBanco, noBanco, prepararAcao } from "@/lib/dados/acao-no-banco";
import {
  cancelarSituacaoProgramada,
  confirmarSituacaoProgramada,
  corrigirUltimoEvento,
  lancarODiaEmLote,
  programarSituacao,
  type ResultadoDoLote,
} from "@/lib/dados/lancar-o-dia";
import {
  lancarSituacaoNaHora,
  lerUltimoEvento,
  type UltimoEvento,
} from "@/lib/dados/ultimo-evento";
import {
  esquemaCancelarProgramada,
  esquemaConfirmarProgramada,
  esquemaCorrigirUltimo,
  esquemaLancarNaHora,
  esquemaLancarODia,
  esquemaProgramar,
  instanteEmSaoPaulo,
} from "@/lib/dominio/esquemas/dia-cr-e-baixa";
import { exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { erroDaAcao, type ResultadoDaAcao } from "@/lib/wizard/resultado";
import { z } from "zod";

// A2 pela grade do Acompanhamento: Lançar o dia em lote (tudo ou nada), Programar, Confirmar e Cancelar
// a situação programada, lançar na hora e Corrigir o último evento. Finas: permissão (exigirPermissao,
// frota.criar; o banco confere o escopo), envelope, dados pelo MESMO esquema da tela (safeParse) e a
// função atômica; só se gravou, invalidam a grade.

const CRIAR = { modulo: "frota", acao: "criar" } as const;
const GRADE = ["/frota/acompanhamento", "/frota/placas"];

const preparar = <T>(bruto: unknown, esquema: z.ZodType<T>) =>
  prepararAcao(
    () => exigirPermissao(CRIAR),
    bruto,
    (d) => esquema.safeParse(d),
  );

/** Tudo ou nada: com recusados, nada grava e a linha devolvida diz quais (a tela tira e lança os outros). */
export async function lancarODiaAcao(bruto: unknown): Promise<ResultadoDaAcao<ResultadoDoLote>> {
  const p = await preparar(bruto, esquemaLancarODia);
  if (!p.ok) return p.erro;
  return noBanco("lançar o dia", (c) => lancarODiaEmLote(c, p.dados, p.chave), GRADE);
}

export async function programarSituacaoAcao(bruto: unknown) {
  const p = await preparar(bruto, esquemaProgramar);
  if (!p.ok) return p.erro;
  return noBanco("programar situação", (c) => programarSituacao(c, p.dados, p.chave), GRADE);
}

export async function confirmarProgramadaAcao(bruto: unknown) {
  const p = await preparar(bruto, esquemaConfirmarProgramada);
  if (!p.ok) return p.erro;
  return noBanco(
    "confirmar situação programada",
    (c) => confirmarSituacaoProgramada(c, p.dados.programadaId, p.dados.versao, p.chave),
    GRADE,
  );
}

export async function cancelarProgramadaAcao(bruto: unknown) {
  const p = await preparar(bruto, esquemaCancelarProgramada);
  if (!p.ok) return p.erro;
  return noBanco(
    "cancelar situação programada",
    (c) => cancelarSituacaoProgramada(c, p.dados.programadaId, p.dados.motivo, p.chave),
    GRADE,
  );
}

export async function lancarNaHoraAcao(bruto: unknown) {
  const p = await preparar(bruto, esquemaLancarNaHora);
  if (!p.ok) return p.erro;
  const { ativoId, sigla, dia, hora } = p.dados;
  return noBanco(
    "lançar na hora",
    (c) => lancarSituacaoNaHora(c, { ativoId, sigla, em: instanteEmSaoPaulo(dia, hora) }),
    GRADE,
  );
}

export async function corrigirUltimoEventoAcao(bruto: unknown) {
  const p = await preparar(bruto, esquemaCorrigirUltimo);
  if (!p.ok) return p.erro;
  return noBanco(
    "corrigir o último evento",
    (c) => corrigirUltimoEvento(c, p.dados, p.chave),
    GRADE,
  );
}

/** O último evento ativo da placa, para o popup "Corrigir o último evento". */
export async function ultimoEventoAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<UltimoEvento | null>> {
  try {
    await exigirPermissao(CRIAR);
  } catch {
    return erroDaAcao("sem_permissao");
  }
  const ativo = z.string().uuid().safeParse(bruto);
  if (!ativo.success) return erroDaAcao("entrada_invalida");
  return lerNoBanco("ler o último evento", (c) => lerUltimoEvento(c, ativo.data));
}
