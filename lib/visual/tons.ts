// Cor de módulo diz onde a pessoa está; cor de status diz como está a placa. Nunca misturar.
// Administração é um módulo próprio que usa a cor de Cadastros; Início usa o azul de ação.
export const MODULOS = [
  "frota",
  "operacional",
  "operacoes",
  "pessoas",
  "parceiros",
  "resultados",
  "cadastros",
  "admin",
] as const;

export const STATUS = ["em-atividade", "atencao", "impedida", "patio", "fora"] as const;

export type Modulo = (typeof MODULOS)[number];
export type Status = (typeof STATUS)[number];

/** Nome da variável CSS forte do módulo; a suave é o mesmo nome com `-suave`. */
export function variavelDoModulo(modulo: Modulo): string {
  return `--modulo-${modulo === "admin" ? "cadastros" : modulo}`;
}

/** Nome da variável CSS forte do status; a suave é o mesmo nome com `-suave`. */
export function variavelDoStatus(status: Status): string {
  return `--status-${status}`;
}
