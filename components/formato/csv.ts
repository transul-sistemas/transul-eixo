// O formato CSV do Eixo (exportações pelo servidor): ponto e vírgula, BOM, \r\n, aspas só quando
// precisa e fórmula neutralizada. Os valores chegam já formatados por components/formato/.

const PRECISA_DE_ASPAS = /[;"\r\n]/;
const PARECE_FORMULA = /^[=+\-@]/;

function campo(valor: string | null): string {
  if (valor === null) return "";
  const seguro = PARECE_FORMULA.test(valor) ? `'${valor}` : valor;
  return PRECISA_DE_ASPAS.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function montarCsv(
  cabecalho: readonly string[],
  linhas: readonly (readonly (string | null)[])[],
): string {
  const corpo = [cabecalho, ...linhas].map((l) => l.map(campo).join(";")).join("\r\n");
  return `﻿${corpo}\r\n`;
}
