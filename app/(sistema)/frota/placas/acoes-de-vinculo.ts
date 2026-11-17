"use server";

import { z } from "zod";
import { lerNoBanco, noBanco, prepararAcao } from "@/lib/dados/acao-no-banco";
import {
  aprovarBaixa,
  cancelarPedidoDeBaixa,
  type ImpactoDaBaixa,
  lerImpactoDaBaixa,
  pedirBaixa,
  recusarBaixa,
} from "@/lib/dados/baixa";
import { lerVinculosDaPlaca, type VinculosDaPlaca } from "@/lib/dados/vinculos-da-placa";
import { trocarCr } from "@/lib/dados/vinculos-de-cr";
import {
  esquemaCancelarBaixa,
  esquemaDecidirBaixa,
  esquemaPedirBaixa,
  esquemaTrocarCr,
  instanteEmSaoPaulo,
} from "@/lib/dominio/esquemas/dia-cr-e-baixa";
import { normalizarPlaca, placaNormalizadaValida } from "@/lib/dominio/placa";
import { exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { erroDaAcao, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// Trocar CR (V0) e Baixa com quatro olhos (S4), pelas funções atômicas da n1-banco. Finas: permissão
// (exigirPermissao), envelope, dados pelo MESMO esquema da tela (safeParse), a função do banco (que
// confere o escopo, a versão e a regra de quatro olhos: quem pede não aprova) e a invalidação.

const CRIAR = { modulo: "frota", acao: "criar" } as const;
const EDITAR = { modulo: "frota", acao: "editar" } as const;
const TELAS = [
  "/frota/placas",
  "/frota/acompanhamento",
  "/inicio/tarefas",
  "/cadastros/saude-do-cr",
];

/** O ativo e os CRs (com a história) da placa, para abrir Trocar CR e Pedir baixa. */
export async function vinculosDaPlacaAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<VinculosDaPlaca | null>> {
  try {
    await exigirPermissao(CRIAR);
  } catch {
    return erroDaAcao("sem_permissao");
  }
  const placa = z.string().safeParse(bruto);
  if (!placa.success || !placaNormalizadaValida(normalizarPlaca(placa.data)))
    return erroDaAcao("entrada_invalida");
  return lerNoBanco("ler os vínculos da placa", (c) =>
    lerVinculosDaPlaca(c, normalizarPlaca(placa.data)),
  );
}

export async function trocarCrAcao(bruto: unknown) {
  const p = await prepararAcao(
    () => exigirPermissao(EDITAR),
    bruto,
    (d) => esquemaTrocarCr.safeParse(d),
  );
  if (!p.ok) return p.erro;
  const { dia, ...resto } = p.dados;
  return noBanco(
    "trocar CR",
    (c) => trocarCr(c, { ...resto, em: instanteEmSaoPaulo(dia, "00:00") }, p.chave),
    [...TELAS, "/operacoes/lista"],
  );
}

const IMPACTO = z.object({ ativoId: z.string().uuid(), dia: z.string() });

export async function impactoDaBaixaAcao(bruto: unknown): Promise<ResultadoDaAcao<ImpactoDaBaixa>> {
  try {
    await exigirPermissao(CRIAR);
  } catch {
    return erroDaAcao("sem_permissao");
  }
  const e = IMPACTO.safeParse(bruto);
  if (!e.success) return erroDaAcao("entrada_invalida");
  return lerNoBanco("ler o impacto da baixa", (c) =>
    lerImpactoDaBaixa(c, e.data.ativoId, instanteEmSaoPaulo(e.data.dia, "00:00")),
  );
}

export async function pedirBaixaAcao(bruto: unknown) {
  const p = await prepararAcao(
    () => exigirPermissao(CRIAR),
    bruto,
    (d) => esquemaPedirBaixa.safeParse(d),
  );
  if (!p.ok) return p.erro;
  const { dia, ...resto } = p.dados;
  return noBanco(
    "pedir baixa",
    (c) => pedirBaixa(c, { ...resto, em: instanteEmSaoPaulo(dia, "00:00") }, p.chave),
    TELAS,
  );
}

/** A Diretoria aprova ou recusa; o banco recusa se quem decide for quem pediu. */
export async function decidirBaixaAcao(bruto: unknown) {
  const p = await prepararAcao(
    () => exigirPermissao(EDITAR),
    bruto,
    (d) => esquemaDecidirBaixa.safeParse(d),
  );
  if (!p.ok) return p.erro;
  const { pedidoId, versao, decisao, motivo } = p.dados;
  return noBanco(
    "decidir baixa",
    (c) =>
      decisao === "aprovar"
        ? aprovarBaixa(c, pedidoId, versao, p.chave)
        : recusarBaixa(c, pedidoId, motivo, versao, p.chave),
    TELAS,
  );
}

export async function cancelarPedidoDeBaixaAcao(bruto: unknown) {
  const p = await prepararAcao(
    () => exigirPermissao(CRIAR),
    bruto,
    (d) => esquemaCancelarBaixa.safeParse(d),
  );
  if (!p.ok) return p.erro;
  return noBanco(
    "cancelar pedido de baixa",
    (c) => cancelarPedidoDeBaixa(c, p.dados.pedidoId, p.chave),
    TELAS,
  );
}
