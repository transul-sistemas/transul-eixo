// O resumo de uma consulta: só agregados (linhas e, por coluna, preenchimento, distintos e, nas colunas
// numéricas, soma, mínimo e máximo). É o que aparece na tela; nenhum valor de célula.

import type { ResultadoDaConsulta } from "./cliente.ts";

export interface ResumoDaColuna {
  nome: string;
  tipo: string;
  preenchidos: number;
  vazios: number;
  distintos: number;
  soma?: number;
  minimo?: number;
  maximo?: number;
}

export interface ResumoDaConsulta {
  linhas: number;
  colunas: ResumoDaColuna[];
}

const vazio = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");
const numero = (v: unknown) =>
  typeof v === "number"
    ? v
    : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())
      ? Number(v)
      : NaN;

export function resumir(resultado: ResultadoDaConsulta): ResumoDaConsulta {
  return {
    linhas: resultado.linhas.length,
    colunas: resultado.colunas.map((coluna, i) => {
      const valores = resultado.linhas.map((linha) => linha[i]).filter((v) => !vazio(v));
      const resumo: ResumoDaColuna = {
        nome: coluna.nome,
        tipo: coluna.tipo,
        preenchidos: valores.length,
        vazios: resultado.linhas.length - valores.length,
        distintos: new Set(valores.map((v) => String(v))).size,
      };
      const numeros = valores.map(numero);
      if (numeros.length > 0 && numeros.every((n) => Number.isFinite(n))) {
        resumo.soma = numeros.reduce((a, b) => a + b, 0);
        resumo.minimo = Math.min(...numeros);
        resumo.maximo = Math.max(...numeros);
      }
      return resumo;
    }),
  };
}

/** O texto da tela: só os agregados. */
export function textoDoResumo(arquivo: string, resumo: ResumoDaConsulta): string {
  const linhas = [`${arquivo}: ${resumo.linhas} linhas`];
  for (const c of resumo.colunas) {
    const numeros =
      c.soma === undefined ? "" : ` · soma ${c.soma} · mínimo ${c.minimo} · máximo ${c.maximo}`;
    linhas.push(
      `  ${c.nome} (${c.tipo}): ${c.preenchidos} preenchidos, ${c.vazios} vazios, ${c.distintos} distintos${numeros}`,
    );
  }
  return linhas.join("\n");
}
