import { placaNormalizadaValida } from "@/lib/dominio/placa";

const FICHA_DA_PLACA = /^\/frota\/placas\/([^/]+)\/?$/;

/**
 * Decide, só pelo caminho, se um pedido segue para a rota ou já é "não encontrada". A ficha da placa
 * (`/frota/placas/<placa>`) só existe para a placa já normalizada; qualquer outra coisa (minúscula,
 * hífen, tamanho errado, HTML, escape quebrado) é barrada antes de a rota renderizar, para o 404 ser
 * de verdade (a rota usa Partial Prerender e o casco sai antes de a página poder chamar
 * `notFound()`). O que não é a ficha, ou é mais fundo que ela, segue.
 */
export function decidirFicha(caminho: string): "seguir" | "nao-encontrada" {
  const achado = FICHA_DA_PLACA.exec(caminho);
  if (!achado) return "seguir";
  let placa: string;
  try {
    placa = decodeURIComponent(achado[1] as string);
  } catch {
    return "nao-encontrada";
  }
  return placaNormalizadaValida(placa) ? "seguir" : "nao-encontrada";
}
