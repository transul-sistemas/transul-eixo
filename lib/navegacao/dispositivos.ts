import { acharTela } from "./catalogo";

export const AVISO_DE_COMPUTADOR = "Esta tela funciona melhor em um computador.";

/**
 * Aviso para o celular quando a tela não foi desenhada para ele (`dispositivos` do catálogo não
 * inclui `celular`). É só um aviso: a tela continua utilizável. Rota fora do catálogo não avisa.
 */
export function avisoDeDispositivo(rota: string): string | undefined {
  const achada = acharTela(rota);
  if (!achada) return undefined;
  return achada.tela.dispositivos.includes("celular") ? undefined : AVISO_DE_COMPUTADOR;
}
