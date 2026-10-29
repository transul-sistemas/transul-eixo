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

function oklab(hex: string): [number, number, number] {
  const achado = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!achado) throw new Error(`Cor inválida: ${hex}`);
  const [r, g, b] = [achado[1], achado[2], achado[3]].map((c) =>
    canalLinear(parseInt(c ?? "0", 16)),
  ) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Distância perceptual entre duas cores `#RRGGBB` (OKLab, escala 0 a 100). */
export function distancia(a: string, b: string): number {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return 100 * Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Mistura `a` com `b`: `proporcao` de `a` (0 a 1) sobre `b`, em sRGB, como `color-mix(in srgb, ...)`. */
export function misturar(a: string, b: string, proporcao: number): string {
  const canais = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [ca, cb] = [canais(a), canais(b)] as [number[], number[]];
  const mistura = ca.map((x, i) => Math.round(x * proporcao + (cb[i] ?? 0) * (1 - proporcao)));
  return `#${mistura
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}
