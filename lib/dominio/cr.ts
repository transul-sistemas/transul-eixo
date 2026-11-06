// O tipo do CR no Eixo (decisão de 03/11/2026), derivado de dois sinais do Sankhya (TSICUS):
// AD_FROTA ("Participa da Frota?") e VEICULO ("veículo obrigatório"). Espelho de `nucleo.tipo_do_cr`;
// a assinatura é conferida no Vitest e no pgTAP (60 e 65). Regra de 03/11/2026, pela lista real do
// Sankhya: AD_FROTA "N" ou vazio é serviço (o vazio nunca fica pendente).

export type TipoDoCr =
  "servico" | "frota_de_ativo" | "frota_sem_placa" | "acionista" | "participacoes" | "transulog";

/** AD_FROTA "S" e VEICULO "S": frota de ativo (placa ou equipamento); AD_FROTA "S" e VEICULO diferente de "S": frota sem
 * placa; AD_FROTA "N" ou vazio: serviço. */
export function tipoDoCr(
  participaDaFrota: boolean | null,
  veiculoObrigatorio: boolean | null,
): TipoDoCr {
  if (participaDaFrota !== true) return "servico";
  return veiculoObrigatorio === true ? "frota_de_ativo" : "frota_sem_placa";
}

const nome = (sinal: boolean | null) => (sinal === null ? "nulo" : String(sinal));

/** As nove combinações "AD_FROTA|VEICULO|tipo", em ordem de código, separadas por vírgula. */
export function assinaturaDoTipoDoCr(): string {
  const sinais = [null, false, true] as const;
  return sinais
    .flatMap((f) => sinais.map((v) => `${nome(f)}|${nome(v)}|${tipoDoCr(f, v)}`))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join(",");
}

/** O md5 de `assinaturaDoTipoDoCr()`: a mesma constante que o pgTAP confere no banco. */
export const ASSINATURA_DO_TIPO_DO_CR = "a8823458d9dc448f92e48d710b52f760";

// Fatia 3.9c (06/11/2026): o tipo vem da unidade gerencial (o "Gerencial" do Sankhya); AD_FROTA vira
// conferência. Dentro da frota, VEICULO "N" é frota sem placa; "S" ou sem o sinal, frota de ativo.
// Espelho de `nucleo.tipo_do_cr_pela_unidade`, com a assinatura conferida no pgTAP 67.

export const UNIDADES_GERENCIAIS = [
  "acionista",
  "frota",
  "participacoes",
  "servico",
  "transulog",
] as const;
export type UnidadeGerencial = (typeof UNIDADES_GERENCIAIS)[number];

export function tipoDoCrPelaUnidade(
  unidade: UnidadeGerencial,
  veiculoObrigatorio: boolean | null,
): TipoDoCr {
  if (unidade === "frota")
    return veiculoObrigatorio === false ? "frota_sem_placa" : "frota_de_ativo";
  return unidade;
}

/** As quinze combinações "unidade|VEICULO|tipo", em ordem, separadas por vírgula. */
export function assinaturaDoTipoPelaUnidade(): string {
  const sinais = [null, false, true] as const;
  return UNIDADES_GERENCIAIS.flatMap((u) =>
    sinais.map((v) => `${u}|${nome(v)}|${tipoDoCrPelaUnidade(u, v)}`),
  )
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join(",");
}

/** O md5 de `assinaturaDoTipoPelaUnidade()`: a mesma constante que o pgTAP 67 confere no banco. */
export const ASSINATURA_DO_TIPO_PELA_UNIDADE = "d01179725d9db49ddb5bb56cdcb9ce37";
