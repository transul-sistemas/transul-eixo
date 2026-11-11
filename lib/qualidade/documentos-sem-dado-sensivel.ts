// Documentação sem dado sensível (Alexandre, 11/11/2026; docs/auditoria-de-exposicao.md). O repositório é
// público: os documentos não levam CPF, CNPJ, chave, nome de pessoa, de acionista nem de cliente, e valores
// reais de receita, despesa ou margem só em percentual ou fictício. Aqui ficam os detectores (puros, para o
// teste provar cada um) e a lista dos documentos que se varre. Nomes não têm detector: só o dicionário do banco,
// que não pode ir para o repositório, os acha (ver a auditoria).
import { lerTexto, listarArquivos } from "./armadilhas";

export interface Achados {
  cpf: number;
  cnpj: number;
  chave: number;
  dinheiroGrande: number;
}

const CPF_FORMATADO = /(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/g;
const CPF_SOLTO = /cpf[^\n]{0,20}?(?<!\d)\d{11}(?!\d)/gi;
const CNPJ = /(?<!\d)\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}(?!\d)/g;

// Chaves e tokens com formato próprio: nenhum documento tem motivo para trazer um.
const CHAVES_DE_FORMATO_PROPRIO: readonly RegExp[] = [
  /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]{16,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{35}/g,
];

// Atribuição de senha ou segredo com valor, e string de conexão com senha: só passam com marcador no lugar.
const MARCADOR =
  /xxx|changeme|example|exemplo|<|\$\{|process\.env|env\(|seu_|sua_|\.\.\.|placeholder|fake|senha|password|your|\[|segredo|local|test|teste/i;
const CONEXAO_COM_SENHA = /postgres(?:ql)?:\/\/[^\s'"<>:@]+:([^\s'"<>@]+)@/g;
const ATRIBUICAO_DE_SEGREDO =
  /\b(?:password|passwd|senha|secret|api[_-]?key|client[_-]?secret|x-token|access[_-]?token|private[_-]?key|service[_-]?role)["']?\s*[:=]\s*["']([^"'\s]{10,})["']/gi;

// Dinheiro grande: valor completo a partir de dez mil reais, ou abreviado em mi, mil e bi.
const DINHEIRO_COMPLETO = /R\$\s?-?\d{2,3}(?:\.\d{3})+(?:,\d{2})?/g;
const DINHEIRO_ABREVIADO = /R\$\s?\d+(?:,\d+)?\s?(?:mi|mil|bi|milh(?:ão|ões|oes))(?![\p{L}])/giu;

const contar = (texto: string, rx: RegExp): number => texto.match(rx)?.length ?? 0;

function contarLiterais(texto: string, rx: RegExp): number {
  let n = 0;
  for (const m of texto.matchAll(rx)) if (!MARCADOR.test(m[1] ?? "")) n++;
  return n;
}

/** O que há de sensível num documento (só contagens: o valor achado nunca é devolvido nem impresso). */
export function achadosNoDocumento(texto: string): Achados {
  return {
    cpf: contar(texto, CPF_FORMATADO) + contar(texto, CPF_SOLTO),
    cnpj: contar(texto, CNPJ),
    chave:
      CHAVES_DE_FORMATO_PROPRIO.reduce((n, rx) => n + contar(texto, rx), 0) +
      contarLiterais(texto, CONEXAO_COM_SENHA) +
      contarLiterais(texto, ATRIBUICAO_DE_SEGREDO),
    dinheiroGrande: contar(texto, DINHEIRO_COMPLETO) + contar(texto, DINHEIRO_ABREVIADO),
  };
}

/**
 * Os documentos varridos: todo `docs/**.md` (menos `docs/prototipos/`, que é HTML com dados fictícios) e o
 * `CLAUDE.md`. Os arquivos que não são documento (código, testes, seeds) ficam de fora desta regra.
 */
export function documentosVarridos(): string[] {
  return [
    ...listarArquivos("docs", /\.md$/).filter((c) => !c.startsWith("docs/prototipos/")),
    "CLAUDE.md",
  ].sort();
}

export function lerAchados(caminho: string): Achados {
  return achadosNoDocumento(lerTexto(caminho));
}
