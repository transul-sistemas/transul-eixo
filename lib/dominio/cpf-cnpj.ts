// CPF e CNPJ: a mesma conta de nucleo.documento_valido (o banco confere de novo). O documento circula
// só com os dígitos; a tela mostra o mascarado que o banco devolve.

export type TipoDeDocumento = "cpf" | "cnpj";

export function normalizarDocumento(texto: string): string {
  return texto.replace(/\D/g, "");
}

export function tipoDoDocumento(texto: string): TipoDeDocumento | null {
  const d = normalizarDocumento(texto);
  if (d.length === 11) return "cpf";
  if (d.length === 14) return "cnpj";
  return null;
}

function digito(base: string, pesos: readonly number[]): number {
  const soma = pesos.reduce((total, peso, i) => total + Number(base[i]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const PESOS_CPF_1 = [10, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const PESOS_CPF_2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as const;

/** CPF (11 dígitos) ou CNPJ (14) com os dois dígitos verificadores certos e sem todos iguais. */
export function documentoValido(texto: string): boolean {
  const d = normalizarDocumento(texto);
  const tipo = tipoDoDocumento(d);
  if (tipo === null || /^(\d)\1+$/.test(d)) return false;
  const [pesos1, pesos2] =
    tipo === "cpf" ? [PESOS_CPF_1, PESOS_CPF_2] : [PESOS_CNPJ_1, PESOS_CNPJ_2];
  const n = d.length;
  const dv1 = digito(d, pesos1);
  const dv2 = digito(d.slice(0, n - 2) + String(dv1), pesos2);
  return d.slice(n - 2) === `${dv1}${dv2}`;
}
