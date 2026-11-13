// O filtro "Demo" da fila de exceções: as marcas da carga de demonstração (docs/demonstracao.md).

export interface ExcecaoMarcavel {
  placa: string | null;
  cr: string | null;
  pessoaNome: string | null;
  descricao: string;
}

export function ehExcecaoDaDemonstracao(l: ExcecaoMarcavel): boolean {
  return (
    (l.placa?.startsWith("ZDM") ?? false) ||
    (l.cr?.startsWith("DEMO-") ?? false) ||
    (l.pessoaNome?.startsWith("Demo ") ?? false) ||
    l.descricao.includes("DEMO-")
  );
}

/** Uma página de uma lista já filtrada no servidor; a página além do fim volta à última. */
export function paginar<T>(itens: readonly T[], pagina: number, tamanho: number) {
  const ultima = Math.max(1, Math.ceil(itens.length / tamanho));
  const p = Math.min(Math.max(1, pagina), ultima);
  return { linhas: itens.slice((p - 1) * tamanho, p * tamanho), total: itens.length, pagina: p };
}
