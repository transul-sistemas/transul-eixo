// Migration não carrega dado no staging (Lote 2, 10/11/2026): a carga da v1 é por script local, e a
// migration vai à nuvem. Só estrutura (schema, tabela, índice, política) e funções.

export interface AchadoNoStaging {
  linha: number;
  trecho: string;
}

const STAGING = String.raw`"?staging"?\s*\.`;
const CARGAS = [
  new RegExp(String.raw`\binsert\s+into\s+${STAGING}`, "i"),
  new RegExp(String.raw`(^|[^\w])\\?copy\s+${STAGING}`, "i"),
  new RegExp(
    String.raw`\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?${STAGING}\s*"?\w+"?\s+as\b`,
    "i",
  ),
  new RegExp(String.raw`\bselect\b[^;]*\binto\s+${STAGING}`, "i"),
];

// Apaga os comentários (de linha e de bloco) e o conteúdo dos textos entre aspas, mantendo as quebras de linha.
function soOCodigo(sql: string): string {
  let saida = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const proximo = sql[i + 1];
    if (c === "-" && proximo === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
    } else if (c === "/" && proximo === "*") {
      const fim = sql.indexOf("*/", i + 2);
      const trecho = sql.slice(i, fim === -1 ? sql.length : fim + 2);
      saida += trecho.replace(/[^\n]/g, " ");
      i += trecho.length;
    } else if (c === "'") {
      saida += "'";
      i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          i += 2;
        } else if (sql[i] === "'") {
          break;
        } else {
          if (sql[i] === "\n") saida += "\n";
          i++;
        }
      }
      saida += "'";
      i++;
    } else {
      saida += c;
      i++;
    }
  }
  return saida;
}

/** As linhas da migration que carregam dado no staging (insert, copy, create table … as, select into). */
export function dadosEmStaging(sql: string): AchadoNoStaging[] {
  const original = sql.split(/\r?\n/);
  return soOCodigo(sql)
    .split(/\r?\n/)
    .flatMap((codigo, indice) =>
      CARGAS.some((re) => re.test(codigo))
        ? [{ linha: indice + 1, trecho: (original[indice] ?? "").trim().slice(0, 80) }]
        : [],
    );
}
