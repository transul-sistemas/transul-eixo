import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// Logo provisório da TranSul em PNG (preto, fundo transparente). É o ÚNICO arquivo que cita a
// imagem: quando o SVG oficial chegar, a troca é aqui e em app/icon.svg (docs/decisoes.md).
// O logo é usado como máscara e pintado com o token da marca, então muda de cor com o tema.
const IMAGEM = "/marca/transul-horizontal-preto.png";

// Medidas do PNG provisório, em pixels: imagem 1854 × 653; logo 1476 × 337 a partir de (189, 158);
// símbolo 480 × 337 a partir de (190, 158). Os percentuais abaixo recortam só o desenho.
const RECORTES = {
  inteiro: { proporcao: "1476 / 337", tamanho: "125.61% auto", posicao: "50% 50%" },
  simbolo: { proporcao: "480 / 337", tamanho: "386.25% auto", posicao: "13.83% 50%" },
} as const;

/**
 * Assinatura da TranSul. A cor vem de `--marca-transul`; quem usa sobre fundo próprio (como a
 * placa do Eixo) define `--cor-da-marca`. Defina a altura por `className` (ex.: `h-4`).
 */
export function AssinaturaTranSul({
  apenasSimbolo = false,
  className,
}: {
  apenasSimbolo?: boolean;
  className?: string;
}) {
  const recorte = RECORTES[apenasSimbolo ? "simbolo" : "inteiro"];
  const estilo: CSSProperties = {
    aspectRatio: recorte.proporcao,
    backgroundColor: "var(--cor-da-marca, var(--marca-transul))",
    maskImage: `url(${IMAGEM})`,
    WebkitMaskImage: `url(${IMAGEM})`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskSize: recorte.tamanho,
    WebkitMaskSize: recorte.tamanho,
    maskPosition: recorte.posicao,
    WebkitMaskPosition: recorte.posicao,
  };
  return (
    <span
      role="img"
      aria-label="TranSul"
      data-marca="transul"
      data-recorte={apenasSimbolo ? "simbolo" : "inteiro"}
      style={estilo}
      className={cn("inline-block shrink-0", className)}
    />
  );
}
