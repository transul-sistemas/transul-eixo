function canalLinear(canal: number): number {
  const c = canal / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const achado = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!achado) throw new Error(`Cor inválida: ${hex}`);
  const [, r, g, b] = achado as unknown as [string, string, string, string];
  return (
    0.2126 * canalLinear(parseInt(r, 16)) +
    0.7152 * canalLinear(parseInt(g, 16)) +
    0.0722 * canalLinear(parseInt(b, 16))
  );
}

/** Razão de contraste WCAG entre duas cores `#RRGGBB`. */
export function contraste(a: string, b: string): number {
  const [maior, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (maior + 0.05) / (menor + 0.05);
}
