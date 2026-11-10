// Logs seguros (Lote 2, 10/11/2026): nenhum console.* ou logger.* mostra placa nem a mensagem crua do
// banco (message, details, hint, ou o objeto do erro inteiro, que leva os três). O log leva só o código
// (SQLSTATE) e um texto nosso; para o erro, `textoDoErro` (lib/log/erro.ts). Exceção só com o comentário
// `log-seguro: <motivo>` na linha da chamada ou na anterior. Funções puras sobre texto.

export interface LogInseguro {
  linha: number;
  motivo: "placa" | "mensagem do banco" | "objeto do erro";
}

const CHAMADA_DE_LOG = /\b(?:console|logger)\.(?:log|error|warn|info|debug|trace)\s*\(/g;
const MENSAGEM_DO_BANCO = /\.\s*(?:message|details|hint)\b/;
const PLACA = /\bplaca\w*/i;
const NOME_DE_ERRO = String.raw`\b(?:e|err|erro|error|excecao)\b`;
const PARTE_SEGURA_DO_ERRO = new RegExp(
  String.raw`${NOME_DE_ERRO}\s*\.\s*(?:code|codigo|name|status)\b|${NOME_DE_ERRO}\s+instanceof\b`,
  "g",
);
const AJUDANTES_SEGUROS = /\btextoDoErro\s*\(\s*[\w.]+\s*\)/g;
const OBJETO_DO_ERRO = new RegExp(NOME_DE_ERRO);

/**
 * Do índice de um texto ('…', "…" ou `…`) até depois do fecho. No modelo (crase), o que está em ${…}
 * volta como código em `interpolado`; o texto em si some.
 */
function lerTexto(codigo: string, inicio: number): { fim: number; interpolado: string } {
  const aspas = codigo[inicio];
  let i = inicio + 1;
  let interpolado = "";
  while (i < codigo.length && codigo[i] !== aspas) {
    if (codigo[i] === "\\") {
      i += 2;
    } else if (aspas === "`" && codigo[i] === "$" && codigo[i + 1] === "{") {
      const { fim, codigo: dentro } = lerAteFechar(codigo, i + 2, "}");
      interpolado += ` ${dentro} `;
      i = fim + 1;
    } else {
      i++;
    }
  }
  return { fim: i + 1, interpolado };
}

/** Lê o código até o fecho que equilibra (")" ou "}"), sem os textos; devolve o índice do fecho. */
function lerAteFechar(
  codigo: string,
  inicio: number,
  fecho: ")" | "}",
): { fim: number; codigo: string } {
  const abre = fecho === ")" ? "(" : "{";
  let nivel = 0;
  let saida = "";
  let i = inicio;
  while (i < codigo.length) {
    const c = codigo[i] as string;
    if (c === "'" || c === '"' || c === "`") {
      const texto = lerTexto(codigo, i);
      saida += ` ""${texto.interpolado} `;
      i = texto.fim;
      continue;
    }
    if (c === "/" && codigo[i + 1] === "/") {
      while (i < codigo.length && codigo[i] !== "\n") i++;
      continue;
    }
    if (c === abre) nivel++;
    if (c === fecho) {
      if (nivel === 0) return { fim: i, codigo: saida };
      nivel--;
    }
    saida += c;
    i++;
  }
  return { fim: codigo.length, codigo: saida };
}

/** Os logs do arquivo que mostram placa, a mensagem crua do banco ou o objeto do erro. */
export function logsInseguros(codigo: string): LogInseguro[] {
  const linhasDoArquivo = codigo.split("\n");
  const achados: LogInseguro[] = [];
  for (const chamada of codigo.matchAll(CHAMADA_DE_LOG)) {
    const inicio = chamada.index;
    const linha = codigo.slice(0, inicio).split("\n").length;
    const aoLado = `${linhasDoArquivo[linha - 2] ?? ""}\n${linhasDoArquivo[linha - 1] ?? ""}`;
    if (/log-seguro:/.test(aoLado)) continue;

    const argumentos = lerAteFechar(codigo, inicio + chamada[0].length, ")").codigo;
    const semPartesSeguras = argumentos
      .replace(AJUDANTES_SEGUROS, " ")
      .replace(PARTE_SEGURA_DO_ERRO, " ");
    if (PLACA.test(argumentos)) achados.push({ linha, motivo: "placa" });
    else if (MENSAGEM_DO_BANCO.test(argumentos))
      achados.push({ linha, motivo: "mensagem do banco" });
    else if (OBJETO_DO_ERRO.test(semPartesSeguras))
      achados.push({ linha, motivo: "objeto do erro" });
  }
  return achados;
}
