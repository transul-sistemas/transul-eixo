// O tipo do CR no Eixo (decisão de 05/11/2026), derivado de dois sinais do Sankhya (TSICUS):
// AD_FROTA ("Participa da Frota?") e VEICULO ("veículo obrigatório"). Espelho de `nucleo.tipo_do_cr`;
// a assinatura é conferida no Vitest e no pgTAP (60-operacao-por-montagem.test.sql).

export type TipoDoCr = "servico" | "frota_de_placa" | "frota_sem_placa";

/** Serviço, frota de placa ou frota sem placa; nulo (pendente) sem o sinal que decide. */
export function tipoDoCr(
  participaDaFrota: boolean | null,
  veiculoObrigatorio: boolean | null,
): TipoDoCr | null {
  if (participaDaFrota === null) return null;
  if (!participaDaFrota) return "servico";
  if (veiculoObrigatorio === null) return null;
  return veiculoObrigatorio ? "frota_de_placa" : "frota_sem_placa";
}

const nome = (sinal: boolean | null) => (sinal === null ? "nulo" : String(sinal));

/** As nove combinações "AD_FROTA|VEICULO|tipo", em ordem de código, separadas por vírgula. */
export function assinaturaDoTipoDoCr(): string {
  const sinais = [null, false, true] as const;
  return sinais
    .flatMap((f) => sinais.map((v) => `${nome(f)}|${nome(v)}|${tipoDoCr(f, v) ?? "pendente"}`))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join(",");
}

/** O md5 de `assinaturaDoTipoDoCr()`: a mesma constante que o pgTAP confere no banco. */
export const ASSINATURA_DO_TIPO_DO_CR = "ddb7e0d7b60a5dc8e514fe0deab03297";
