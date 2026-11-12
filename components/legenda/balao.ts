/**
 * O estado do balão com o nome da sigla. Abre por três caminhos independentes (mouse, foco do
 * teclado e toque) e só fecha quando nenhum deles o segura. Função pura, para testar sem navegador.
 */
export interface EstadoDoBalao {
  readonly mouse: boolean;
  readonly foco: boolean;
  readonly fixado: boolean;
}

export type AcaoDoBalao =
  | "entrou-mouse"
  | "saiu-mouse"
  | "focou"
  | "desfocou"
  | "tocou"
  | "tocou-fora"
  | "esc";

export const BALAO_FECHADO: EstadoDoBalao = { mouse: false, foco: false, fixado: false };

export function balaoAberto(estado: EstadoDoBalao): boolean {
  return estado.mouse || estado.foco || estado.fixado;
}

export function reduzirBalao(estado: EstadoDoBalao, acao: AcaoDoBalao): EstadoDoBalao {
  switch (acao) {
    case "entrou-mouse":
      return { ...estado, mouse: true };
    case "saiu-mouse":
      return { ...estado, mouse: false };
    case "focou":
      return { ...estado, foco: true };
    case "desfocou":
      return { ...estado, foco: false };
    case "tocou":
      // O segundo toque fecha o que o primeiro abriu.
      return estado.fixado ? BALAO_FECHADO : { ...estado, fixado: true };
    case "tocou-fora":
    case "esc":
      return BALAO_FECHADO;
  }
}
