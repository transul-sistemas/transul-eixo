// A guarda de leitura da ponte com o Sankhya (fatia S0). O Eixo nunca grava no Sankhya e não depende de a
// conta ser somente leitura: toda consulta passa por aqui antes de sair (decisão de 30/10/2026).
//
//  * só uma consulta, que começa com SELECT ou WITH; nada de comando de escrita, DDL ou pacote do Oracle;
//  * nenhum comentário de bloco; comentário de linha só se não citar comando (e sai antes do envio);
//  * nenhum campo proibido (senhas, PIX, dados bancários, RG, filiação, estado civil, raça, sexo e os
//    sensíveis do dicionário); CPF e CNPJ só em contagem, nunca na consulta de linhas;
//  * nunca SELECT * (nem T.*); só tabelas do dicionário (docs/sankhya), com JOIN explícito;
//  * a consulta de linhas só em tabela sem dado pessoal;
//  * sempre com limite de linhas (o tempo máximo fica no cliente).

export type ModoDaConsulta = "resumo" | "linhas";

export type RegraDaGuarda =
  | "comeco"
  | "ponto_e_virgula"
  | "comando_proibido"
  | "comentario"
  | "campo_proibido"
  | "documento_em_linhas"
  | "select_asterisco"
  | "tabela_fora_do_dicionario"
  | "juncao_por_virgula"
  | "tabela_com_dado_pessoal"
  | "limite";

export class ErroDaGuarda extends Error {
  // Sem propriedade no parâmetro do construtor: o Node roda este arquivo só tirando os tipos.
  readonly regra: RegraDaGuarda;
  constructor(regra: RegraDaGuarda, mensagem: string) {
    super(`[${regra}] ${mensagem}`);
    this.name = "ErroDaGuarda";
    this.regra = regra;
  }
}

export const LIMITE_MAXIMO_DE_LINHAS = 5000;

const COMANDOS_PROIBIDOS = new Set([
  "INSERT",
  "UPDATE",
  "DELETE",
  "MERGE",
  "DROP",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "EXEC",
  "EXECUTE",
  "CALL",
  "BEGIN",
  "DECLARE",
  "COMMIT",
  "ROLLBACK",
]);
const PACOTES_PROIBIDOS = /^(DBMS_|UTL_)/;

// Os campos proibidos do dicionário (docs/sankhya/Eixo_Dados_do_Sankhya.xlsx), pelo nome inteiro.
const CAMPOS_PROIBIDOS = new Set([
  // senhas
  "SENHA",
  "SENHAECONECT",
  "TIMSENHASITE",
  "TIMSENHADESC",
  // PIX
  "CHAVEPIX",
  "AD_TIPCHAVEPIX",
  // dados bancários
  "CODBCO",
  "CODAGE",
  "AGENCIA",
  "CODCTABCO",
  "CODCTABCOINT",
  "TIPCONTA",
  "CTAADIANT",
  "CTAFGTS",
  "TIMCORRESPBANCARIO",
  // RG e identidade
  "IDENTIDADE",
  "IDENTINSCESTAD",
  "TIMDATACI",
  "ORGAORG",
  "DTRG",
  "UFRG",
  "COMPLEMENTORG",
  "METERG",
  "RGCODUFEXPEDICAO",
  // filiação
  "NOMEMAE",
  "NOMEPAI",
  "TIMMAE",
  "TIMPAI",
  "NACIONALPAIS",
  // estado civil, raça, sexo e os sensíveis fora até decisão específica
  "ESTADOCIVIL",
  "TIMESTADOCIVIL",
  "RACAFUNCIONARIO",
  "SEXO",
  "IDENTIDADEGENERO",
  "DEFICIENTEFISICO",
  "TIPDEFICIENCIA",
  "OBSDEFICIENCIA",
  "TITELEITORAL",
  "SECAOELEITORAL",
  "ZONAELEITORAL",
  "TIPCERTIDAO",
  "NROCERTCIVIL",
  "DTEMICERTCIVIL",
  "CODCIDCERTCIVIL",
  // responsáveis do CR (dado de pessoa; docs/sankhya/mapa.md)
  "CODUSURESP",
  "CODPARCRESP",
]);
const CAMPO_DE_SENHA = /SENHA|PASSWORD/;
const CAMPO_DE_DOCUMENTO = /CPF|CNPJ|^CGC$/;

// As tabelas do dicionário (docs/sankhya/mapa.md); o resto é recusado.
const TABELAS_DO_DICIONARIO = new Set([
  "TGFVEI",
  "TMSMARCAVEI",
  "TMSMODELOVEI",
  "TMSTVC",
  "TGFPAR",
  "TSIEMP",
  "TSICUS",
  "TGFNAT",
  "TGFTOP",
  "TCFABT",
  "TCFABTITE",
  "TGFPRO",
  "TGFCAB",
  "TGFFIN",
  "TGFRAT",
  "TFPFUN",
  "TFPCAR",
  "TFPDEP",
  "TFPHFI",
  "TFPFOL",
  "TGFORD",
  "TMSORDAFT",
  "TMSORDAFTITE",
  "TGFMDFE",
  "DUAL",
]);

// A consulta de linhas só nestas tabelas; no TGFVEI, sem proprietário nem motorista.
const TABELAS_SEM_DADO_PESSOAL = new Set([
  "TSICUS",
  "TMSMODELOVEI",
  "TMSMARCAVEI",
  "TGFVEI",
  "DUAL",
]);
const CAMPOS_DE_PESSOA_NO_VEICULO = new Set([
  "CODPARC",
  "CODPARCPROPANTT",
  "CODMOTORISTA",
  "CODFUNC",
  "CODEMPFOLHA",
  "AD_CODPARC",
  "AD_ACIONISTA",
  "CODPARCGESTOR",
  "DESCR_EMP_PARC",
  "EMPPARC",
  "TIPOPROP",
]);

// Funções do Oracle que usam FROM dentro dos parênteses (não é tabela).
const FUNCOES_COM_FROM = new Set(["EXTRACT", "TRIM", "SUBSTRING"]);
const FIM_DO_FROM = new Set([
  "WHERE",
  "GROUP",
  "ORDER",
  "HAVING",
  "UNION",
  "INTERSECT",
  "MINUS",
  "CONNECT",
  "START",
  "FETCH",
]);
const PALAVRAS_QUE_NAO_SAO_APELIDO = new Set([
  ...FIM_DO_FROM,
  "JOIN",
  "INNER",
  "LEFT",
  "RIGHT",
  "FULL",
  "OUTER",
  "CROSS",
  "ON",
  "USING",
]);

type Token =
  | { tipo: "palavra"; texto: string }
  | { tipo: "identificador_citado"; texto: string }
  | { tipo: "texto" }
  | { tipo: "numero"; texto: string }
  | { tipo: "simbolo"; texto: string };

function separar(sql: string): { tokens: Token[]; comentarios: string[]; semComentarios: string } {
  const tokens: Token[] = [];
  const comentarios: string[] = [];
  let semComentarios = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i] as string;
    if (c === "/" && sql[i + 1] === "*") {
      throw new ErroDaGuarda(
        "comentario",
        "Comentário de bloco não é aceito (pode esconder comando ou dica do Oracle).",
      );
    }
    if (c === "-" && sql[i + 1] === "-") {
      const fim = sql.indexOf("\n", i);
      const ate = fim === -1 ? sql.length : fim;
      comentarios.push(sql.slice(i + 2, ate));
      i = ate;
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j += 1;
      }
      tokens.push({ tipo: "texto" });
      semComentarios += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '"') {
      const fim = sql.indexOf('"', i + 1);
      const ate = fim === -1 ? sql.length : fim;
      tokens.push({ tipo: "identificador_citado", texto: sql.slice(i + 1, ate).toUpperCase() });
      semComentarios += sql.slice(i, ate + 1);
      i = ate + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][\w$#]*/.exec(sql.slice(i)) as RegExpExecArray;
      tokens.push({ tipo: "palavra", texto: m[0].toUpperCase() });
      semComentarios += m[0];
      i += m[0].length;
      continue;
    }
    if (/[0-9]/.test(c)) {
      const m = /^[0-9][0-9.]*/.exec(sql.slice(i)) as RegExpExecArray;
      tokens.push({ tipo: "numero", texto: m[0] });
      semComentarios += m[0];
      i += m[0].length;
      continue;
    }
    if (!/\s/.test(c)) tokens.push({ tipo: "simbolo", texto: c });
    semComentarios += c;
    i += 1;
  }
  return { tokens, comentarios, semComentarios };
}

const nome = (t: Token | undefined) =>
  t && (t.tipo === "palavra" || t.tipo === "identificador_citado") ? t.texto : undefined;
const simbolo = (t: Token | undefined, s: string) => t?.tipo === "simbolo" && t.texto === s;

function tabelasConsultadas(tokens: Token[]): string[] {
  // Os nomes do WITH (nome AS ( ... )) não são tabelas do Sankhya.
  const doWith = new Set<string>();
  tokens.forEach((t, i) => {
    if (nome(t) && nome(tokens[i + 1]) === "AS" && simbolo(tokens[i + 2], "("))
      doWith.add(nome(t) as string);
  });

  const tabelas: string[] = [];
  const pilha: (string | undefined)[] = [];
  tokens.forEach((t, i) => {
    if (simbolo(t, "(")) pilha.push(nome(tokens[i - 1]));
    if (simbolo(t, ")")) pilha.pop();
    const palavra = t.tipo === "palavra" ? t.texto : undefined;
    if (palavra !== "FROM" && palavra !== "JOIN") return;
    if (palavra === "FROM" && FUNCOES_COM_FROM.has(pilha[pilha.length - 1] ?? "")) return;

    let j = i + 1;
    if (simbolo(tokens[j], "(")) return; // subconsulta
    let tabela = nome(tokens[j]);
    if (!tabela) return;
    while (simbolo(tokens[j + 1], ".") && nome(tokens[j + 2])) {
      j += 2;
      tabela = nome(tokens[j]) as string;
    }
    if (!doWith.has(tabela)) tabelas.push(tabela);

    // Depois da tabela (e do apelido), uma vírgula seria outra tabela escondida.
    let k = j + 1;
    const apelido = nome(tokens[k]);
    if (apelido && !PALAVRAS_QUE_NAO_SAO_APELIDO.has(apelido)) k += 1;
    if (palavra === "FROM" && simbolo(tokens[k], ",")) {
      throw new ErroDaGuarda(
        "juncao_por_virgula",
        "Use JOIN explícito: a vírgula no FROM pode esconder uma tabela.",
      );
    }
  });
  return tabelas;
}

/**
 * Confere a consulta e devolve o SQL que pode sair (sem comentários de linha nem o ponto e vírgula final).
 * Lança ErroDaGuarda com a regra que recusou.
 */
export function conferirConsulta(sql: string, { modo }: { modo: ModoDaConsulta }): string {
  const { tokens, comentarios, semComentarios } = separar(sql);

  for (const comentario of comentarios) {
    const { tokens: doComentario } = separar(comentario.replace(/['"]/g, " "));
    if (
      doComentario.some(
        (t) =>
          t.tipo === "palavra" &&
          (COMANDOS_PROIBIDOS.has(t.texto) || PACOTES_PROIBIDOS.test(t.texto)),
      )
    ) {
      throw new ErroDaGuarda("comentario", "Comentário que cita comando não é aceito.");
    }
  }

  const pontos = tokens.flatMap((t, i) => (simbolo(t, ";") ? [i] : []));
  if (pontos.length > 1 || (pontos.length === 1 && pontos[0] !== tokens.length - 1)) {
    throw new ErroDaGuarda(
      "ponto_e_virgula",
      "Só uma consulta por arquivo: o ponto e vírgula encadearia outra.",
    );
  }
  const uteis = pontos.length === 1 ? tokens.slice(0, -1) : tokens;

  const primeira = nome(uteis[0]);
  if (primeira !== "SELECT" && primeira !== "WITH") {
    throw new ErroDaGuarda("comeco", "A consulta tem de começar com SELECT ou WITH.");
  }

  for (const t of uteis) {
    if (
      t.tipo === "palavra" &&
      (COMANDOS_PROIBIDOS.has(t.texto) || PACOTES_PROIBIDOS.test(t.texto))
    ) {
      throw new ErroDaGuarda("comando_proibido", `${t.texto} não é aceito: a ponte só lê.`);
    }
  }

  for (const t of uteis) {
    const n = nome(t);
    if (n && (CAMPOS_PROIBIDOS.has(n) || CAMPO_DE_SENHA.test(n))) {
      throw new ErroDaGuarda("campo_proibido", `O campo ${n} é proibido (dado sensível).`);
    }
    if (n && modo === "linhas" && CAMPO_DE_DOCUMENTO.test(n)) {
      throw new ErroDaGuarda(
        "documento_em_linhas",
        `CPF e CNPJ (${n}) só em contagem, nunca na consulta de linhas.`,
      );
    }
  }

  uteis.forEach((t, i) => {
    if (!simbolo(t, "*")) return;
    const antes = uteis[i - 1];
    if (
      ["SELECT", "DISTINCT", "ALL"].includes(nome(antes) ?? "") ||
      simbolo(antes, ",") ||
      simbolo(antes, ".")
    ) {
      throw new ErroDaGuarda("select_asterisco", "Nunca SELECT *: liste os campos.");
    }
  });

  const tabelas = tabelasConsultadas(uteis);
  for (const tabela of tabelas) {
    if (!TABELAS_DO_DICIONARIO.has(tabela)) {
      throw new ErroDaGuarda(
        "tabela_fora_do_dicionario",
        `A tabela ${tabela} não está no dicionário (docs/sankhya).`,
      );
    }
  }

  if (modo === "linhas") {
    for (const tabela of tabelas) {
      if (!TABELAS_SEM_DADO_PESSOAL.has(tabela)) {
        throw new ErroDaGuarda(
          "tabela_com_dado_pessoal",
          `A consulta de linhas não vale para ${tabela} (tem dado pessoal).`,
        );
      }
    }
    if (tabelas.includes("TGFVEI")) {
      const campo = uteis.map(nome).find((n) => n && CAMPOS_DE_PESSOA_NO_VEICULO.has(n));
      if (campo) {
        throw new ErroDaGuarda(
          "tabela_com_dado_pessoal",
          `No TGFVEI, a consulta de linhas não traz ${campo} (proprietário ou motorista).`,
        );
      }
    }
  }

  return semComentarios.trim().replace(/;\s*$/, "").trim();
}

/** Envolve a consulta já conferida num limite de linhas (padrão e máximo: 5000). */
export function envolverComLimite(sql: string, linhas: number = LIMITE_MAXIMO_DE_LINHAS): string {
  if (!Number.isInteger(linhas) || linhas < 1 || linhas > LIMITE_MAXIMO_DE_LINHAS) {
    throw new ErroDaGuarda("limite", `O limite de linhas vai de 1 a ${LIMITE_MAXIMO_DE_LINHAS}.`);
  }
  return `SELECT * FROM (\n${sql}\n) WHERE ROWNUM <= ${linhas}`;
}
