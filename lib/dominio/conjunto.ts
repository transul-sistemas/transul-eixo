// Regras puras do conjunto (cavalo mestre + implementos servos). A tabela de nomenclatura
// (carroceria × configuração) chega com o banco; até lá a carroceria vem do nome do modelo.

const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** "Sider 3 eixos" e "Sider 2 eixos" são a mesma carroceria (Sider): tira a configuração de eixos. */
export function carroceriaDoModelo(modelo: string): string {
  const nome = modelo
    .trim()
    .replace(/\s+\d+.*$/, "")
    .toLowerCase();
  return maiuscula(nome);
}

/** Conjunto misto de carrocerias é bloqueado: todos os implementos têm de ser da mesma carroceria. */
export function conjuntoMisto(carrocerias: readonly string[]): boolean {
  return new Set(carrocerias.map((c) => c.trim().toLowerCase())).size > 1;
}
