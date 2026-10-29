import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Verificações das "Armadilhas conhecidas" (CLAUDE.md e docs/decisoes.md). São funções puras sobre
// texto, para valer igual no teste de unidade e no repositório.

const PASTAS_IGNORADAS = new Set(["node_modules", ".next", ".git", "test-results"]);

export function listarArquivos(pasta: string, padrao: RegExp): string[] {
  let nomes: string[];
  try {
    nomes = readdirSync(pasta);
  } catch {
    return [];
  }
  return nomes.flatMap((nome) => {
    if (PASTAS_IGNORADAS.has(nome)) return [];
    const caminho = `${pasta}/${nome}`;
    return statSync(join(caminho)).isDirectory()
      ? listarArquivos(caminho, padrao)
      : padrao.test(nome)
        ? [caminho]
        : [];
  });
}

export function lerTexto(caminho: string): string {
  return readFileSync(caminho, "utf-8");
}

const semComentarios = (sql: string) => sql.replace(/--[^\n]*/g, "");

const PALAVRAS_DE_RESTRICAO = /^(constraint|foreign|primary|unique|check|exclude)\b/i;

/** Chaves estrangeiras (`tabela.coluna`) que não abrem nenhum índice, chave primária ou unicidade. */
export function fksSemIndice(sql: string): string[] {
  const limpo = semComentarios(sql);
  const faltas: string[] = [];
  for (const tabela of limpo.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)\s*\(([\s\S]*?)\n\s*\)\s*;/gi,
  )) {
    const nome = tabela[1]!.toLowerCase();
    const linhas = tabela[2]!.split("\n").map((l) => l.trim().replace(/,$/, ""));
    const fks: string[] = [];
    const cobertas = new Set<string>();
    for (const linha of linhas) {
      const tabular = /^(?:constraint\s+\w+\s+)?foreign\s+key\s*\(\s*(\w+)/i.exec(linha);
      if (tabular) fks.push(tabular[1]!.toLowerCase());
      else if (/\breferences\b/i.test(linha) && !PALAVRAS_DE_RESTRICAO.test(linha)) {
        fks.push(linha.split(/\s+/)[0]!.toLowerCase());
      }
      const chave = /^(?:constraint\s+\w+\s+)?(?:primary\s+key|unique)\s*\(\s*(\w+)/i.exec(linha);
      if (chave) cobertas.add(chave[1]!.toLowerCase());
      if (!PALAVRAS_DE_RESTRICAO.test(linha) && /\b(primary\s+key|unique)\b/i.test(linha)) {
        cobertas.add(linha.split(/\s+/)[0]!.toLowerCase());
      }
    }
    for (const indice of limpo.matchAll(
      /create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?\w+\s+on\s+([\w.]+)\s*(?:using\s+\w+\s*)?\(\s*(\w+)/gi,
    )) {
      if (indice[1]!.toLowerCase() === nome) cobertas.add(indice[2]!.toLowerCase());
    }
    for (const fk of fks) if (!cobertas.has(fk)) faltas.push(`${nome}.${fk}`);
  }
  return faltas;
}

/** Verdadeiro se há exclusão lógica (`excluido_em`) sem índice parcial `where excluido_em is null`. */
export function softDeleteSemIndiceParcial(sql: string): boolean {
  const limpo = semComentarios(sql);
  if (!/\bexcluido_em\b/i.test(limpo)) return false;
  return !/create\s+(?:unique\s+)?index[^;]*\bwhere\s+excluido_em\s+is\s+null/i.test(limpo);
}

/** Linhas (1, 2, …) com `security definer` sem `-- justificativa: …` até 4 linhas ao redor. */
export function securityDefinerSemJustificativa(sql: string): number[] {
  const linhas = sql.split("\n");
  const faltas: number[] = [];
  linhas.forEach((linha, i) => {
    if (!/^[^-]*\bsecurity\s+definer\b/i.test(linha)) return;
    const vizinhas = linhas.slice(Math.max(0, i - 4), i + 5).join("\n");
    if (!/--\s*justificativa:\s*\S+/i.test(vizinhas)) faltas.push(i + 1);
  });
  return faltas;
}

/** Nomes de política RLS que não aparecem em nenhum teste pgTAP. */
export function politicasSemTeste(migracoes: string, testes: string): string[] {
  const nomes = [
    ...semComentarios(migracoes).matchAll(/create\s+policy\s+(?:"([^"]+)"|(\w+))/gi),
  ].map((m) => (m[1] ?? m[2])!);
  return nomes.filter((nome) => !testes.includes(nome));
}

/** Arquivos que citam a chave mestra (`service_role`) fora de `workers/`. */
export function chaveMestraForaDosWorkers(
  arquivos: { caminho: string; texto: string }[],
): string[] {
  return arquivos
    .filter((a) => !a.caminho.startsWith("workers/") && /service_role/i.test(a.texto))
    .map((a) => a.caminho);
}

/** Verdadeiro se a consulta pede todas as colunas (`select *`). */
export function selectEstrela(texto: string): boolean {
  return /\.select\(\s*["'`]\s*\*\s*["'`]\s*\)|\bselect\s+\*/i.test(texto);
}

/** O que falta numa Server Action: validar a entrada (Zod) e conferir permissão. */
export function serverActionSemGuarda(texto: string): string[] {
  if (!/^\s*["']use server["']/m.test(texto)) return [];
  const faltas: string[] = [];
  if (!/\b(?:safeParse|parse)\(/.test(texto))
    faltas.push("validar a entrada com Zod (safeParse ou parse)");
  if (!/\bexigirPermissao\(/.test(texto)) faltas.push("conferir permissão com exigirPermissao()");
  return faltas;
}
