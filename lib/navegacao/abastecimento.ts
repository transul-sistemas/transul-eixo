import { type ConsultaDeTabela, lerTabela, type PadraoDaTabela } from "./tabela";

// O estado da tela Frota › Abastecimento na URL: o mês (`mes=aaaa-mm`; sem ele, o banco abre o mês
// mais recente com dados) e a tabela (busca `q`, ordem, página e tamanho, como na lista de Placas).

export const ROTA_DO_ABASTECIMENTO = "/frota/abastecimento";

/** Os campos de ordem que nucleo.abastecimento_do_mes aceita (o desempate é sempre a placa). */
export const CAMPOS_DO_ABASTECIMENTO = [
  "placa",
  "abastecimentos",
  "litros",
  "km",
  "km_por_litro",
  "valor",
] as const;

export const PADRAO_DO_ABASTECIMENTO: PadraoDaTabela = { tam: 50, ordem: "placa" };

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface EstadoDoAbastecimento {
  /** `aaaa-mm`, ou nulo para o mês mais recente com dados. */
  mes: string | null;
  consulta: ConsultaDeTabela;
}

export function lerAbastecimento(parametros: URLSearchParams): EstadoDoAbastecimento {
  const mes = parametros.get("mes");
  return {
    mes: mes !== null && MES.test(mes) ? mes : null,
    consulta: lerTabela(parametros, PADRAO_DO_ABASTECIMENTO, CAMPOS_DO_ABASTECIMENTO),
  };
}

/** A mesma visão em outro mês: volta à página 1 e mantém busca, ordem e tamanho. */
export function enderecoDoMesDoAbastecimento(parametros: URLSearchParams, mes: string): string {
  const novos = new URLSearchParams(parametros.toString());
  novos.delete("pagina");
  novos.delete("mes");
  novos.set("mes", mes);
  return `${ROTA_DO_ABASTECIMENTO}?${novos.toString()}`;
}
