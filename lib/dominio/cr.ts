// O tipo do CR no Eixo (decisão de 03/11/2026), derivado de dois sinais do Sankhya (TSICUS):
// AD_FROTA ("Participa da Frota?") e VEICULO ("veículo obrigatório"). Espelho de `nucleo.tipo_do_cr`;
// a assinatura é conferida no Vitest e no pgTAP (60 e 65). Regra de 03/11/2026, pela lista real do
// Sankhya: AD_FROTA "N" ou vazio é serviço (o vazio nunca fica pendente).

export type TipoDoCr = "servico" | "frota_de_ativo" | "frota_sem_placa";

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
