// Paridade entre o código e o banco (11/11/2026): as funções que o app chama (.rpc) existem no banco com os
// mesmos argumentos e o papel `authenticated` pode executá-las. Lógica pura, sem import com alias: o script
// `scripts/paridade-do-banco.ts` roda este arquivo direto no Node. Só nomes de função e de esquema.

export interface UsoDeFuncao {
  esquema: string;
  funcao: string;
  /** Onde foi achado (caminho do arquivo), para quem for consertar. */
  arquivo: string;
}

export interface FuncaoDoBanco {
  argumentos: string[];
  executa: boolean;
}

export type Problema = {
  esquema: string;
  funcao: string;
  motivo: "ausente_dos_tipos" | "ausente_no_banco" | "assinatura_diferente" | "sem_permissao";
};

const LITERAL = String.raw`["'\`]([a-z_][a-z0-9_]*)["'\`]`;

/** Nomes das funções (declaradas ou em const) que recebem o nome da função do banco no parâmetro `funcao`. */
export function embrulhosDeRpc(texto: string): string[] {
  const nomes = new Set<string>();
  const declaracao =
    /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?)(?:<[^()]*>)?\s*\(([^)]*)\)/g;
  for (const m of texto.matchAll(declaracao)) {
    const nome = m[1] ?? m[2];
    if (nome && /\bfuncao\s*:\s*string/.test(m[3] ?? "")) nomes.add(nome);
  }
  // Declaração com parâmetros em várias linhas: function nome<T>(\n cliente,\n funcao: string, ...
  const multilinha = /function\s+(\w+)(?:<[^()]*>)?\s*\(([\s\S]*?)\)\s*[:{]/g;
  for (const m of texto.matchAll(multilinha)) {
    if (m[1] && /\bfuncao\s*:\s*string/.test(m[2] ?? "")) nomes.add(m[1]);
  }
  return [...nomes];
}

/** As chamadas `.schema("x").rpc("nome"` e `.rpc("nome"` (esquema padrão: o do `.schema` mais próximo antes). */
export function usosDiretos(texto: string, arquivo: string): UsoDeFuncao[] {
  const usos: UsoDeFuncao[] = [];
  const re = new RegExp(String.raw`(?:\.schema\(\s*${LITERAL}\s*\)\s*)?\.rpc\(\s*${LITERAL}`, "g");
  for (const m of texto.matchAll(re)) {
    const esquema = m[1] ?? "public";
    if (m[2]) usos.push({ esquema, funcao: m[2], arquivo });
  }
  return usos;
}

/** Chamadas aos embrulhos: o primeiro literal depois de `nome(` ou `nome<T>(`. Esquema: nucleo (único embrulhado). */
export function usosPorEmbrulho(
  texto: string,
  arquivo: string,
  embrulhos: string[],
): UsoDeFuncao[] {
  const usos: UsoDeFuncao[] = [];
  for (const nome of embrulhos) {
    const re = new RegExp(
      String.raw`(?<![\w.])${nome}(?:<[^()]*>)?\(\s*(?:[^,()"'\`]+,\s*)?${LITERAL}\s*[,)]`,
      "g",
    );
    for (const m of texto.matchAll(re)) {
      if (m[1]) usos.push({ esquema: "nucleo", funcao: m[1], arquivo });
    }
  }
  return usos;
}

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

export function usosDoApp(entrada: { caminho: string; texto: string }[]): UsoDeFuncao[] {
  const arquivos = entrada.map((a) => ({ caminho: a.caminho, texto: semComentarios(a.texto) }));
  // Um embrulho vale no arquivo que o declara; só o exportado vale nos outros (nomes como `ler` se repetem).
  const exportados = [
    ...new Set(
      arquivos.flatMap((a) =>
        embrulhosDeRpc(a.texto).filter((n) =>
          new RegExp(`export\s+(?:async\s+)?(?:function\s+|const\s+)${n}\b`).test(a.texto),
        ),
      ),
    ),
  ];
  const todos = arquivos.flatMap((a) => [
    ...usosDiretos(a.texto, a.caminho),
    ...usosPorEmbrulho(a.texto, a.caminho, [
      ...new Set([...embrulhosDeRpc(a.texto), ...exportados]),
    ]),
  ]);
  const vistos = new Map<string, UsoDeFuncao>();
  for (const u of todos)
    if (!vistos.has(`${u.esquema}.${u.funcao}`)) vistos.set(`${u.esquema}.${u.funcao}`, u);
  return [...vistos.values()].sort((a, b) =>
    `${a.esquema}.${a.funcao}`.localeCompare(`${b.esquema}.${b.funcao}`),
  );
}

/** `Functions` do arquivo gerado de tipos: "esquema.função" para os nomes dos argumentos. */
export function funcoesDosTipos(tipos: string): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  const cabecalho = /"([a-z_0-9]+)": \{\n {10}(?:Tables|Enums): \{/g;
  const marcas = [...tipos.matchAll(cabecalho)].map((m) => ({
    esquema: m[1] as string,
    ini: m.index ?? 0,
  }));
  marcas.forEach((marca, i) => {
    const corpo = tipos.slice(marca.ini, marcas[i + 1]?.ini ?? tipos.length);
    const ini = corpo.indexOf("Functions: {");
    if (ini < 0) return;
    const fim = corpo.indexOf("Enums: {", ini);
    const funcoes = corpo.slice(ini, fim < 0 ? undefined : fim);
    for (const m of funcoes.matchAll(/^\s*"([a-z_0-9]+)":\s*\n\{ Args: ([\s\S]*?); Returns:/gm)) {
      const args = m[2] ?? "";
      const nomes = [...args.matchAll(/"([a-z_0-9]+)"\??:/g)].map((a) => a[1] as string);
      mapa.set(`${marca.esquema}.${m[1]}`, nomes);
    }
  });
  return mapa;
}

/** `pg_get_function_identity_arguments` ("p_mes date, p_tam integer") para os nomes. */
export function nomesDosArgumentos(identidade: string): string[] {
  return identidade
    .split(",")
    .map((t) => t.trim().split(/\s+/)[0] ?? "")
    .filter((n) => n !== "" && n !== "IN" && n !== "VARIADIC");
}

const mesmo = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Confere o que o app usa contra os tipos (estático) e, se houver, contra o banco (`banco` ausente: só os tipos). */
export function compararParidade(
  usos: UsoDeFuncao[],
  tipos: Map<string, string[]>,
  banco?: Map<string, FuncaoDoBanco[]>,
): Problema[] {
  const problemas: Problema[] = [];
  for (const { esquema, funcao } of usos) {
    const chave = `${esquema}.${funcao}`;
    const dosTipos = tipos.get(chave);
    if (dosTipos === undefined) {
      problemas.push({ esquema, funcao, motivo: "ausente_dos_tipos" });
      continue;
    }
    if (banco === undefined) continue;
    const sobrecargas = banco.get(chave);
    if (sobrecargas === undefined || sobrecargas.length === 0) {
      problemas.push({ esquema, funcao, motivo: "ausente_no_banco" });
      continue;
    }
    const igual = sobrecargas.filter((s) => mesmo(s.argumentos, dosTipos));
    if (igual.length === 0) problemas.push({ esquema, funcao, motivo: "assinatura_diferente" });
    else if (!igual.some((s) => s.executa))
      problemas.push({ esquema, funcao, motivo: "sem_permissao" });
  }
  return problemas;
}

/** Texto curto, só nomes, para o terminal e o CI. */
export function relatorioDeParidade(problemas: Problema[], total: number): string {
  if (problemas.length === 0)
    return `paridade ok: ${total} funções usadas pelo app existem no banco com a mesma assinatura.`;
  const rotulo: Record<Problema["motivo"], string> = {
    ausente_dos_tipos: "fora dos tipos (rode pnpm db:tipos)",
    ausente_no_banco: "ausente no banco",
    assinatura_diferente: "assinatura diferente",
    sem_permissao: "authenticated sem permissão de executar",
  };
  const linhas = problemas.map((p) => `  - ${p.esquema}.${p.funcao}: ${rotulo[p.motivo]}`);
  return [
    `paridade quebrada: ${problemas.length} de ${total} funções com problema.`,
    ...linhas,
    "aplique as migrations: pnpm exec supabase migration up --local",
  ].join("\n");
}

export function conteinerDoBanco(config: string): string {
  const id = /^project_id\s*=\s*"([^"]+)"/m.exec(config)?.[1];
  if (!id) throw new Error("project_id não encontrado em supabase/config.toml.");
  return `supabase_db_${id}`;
}

export function lerDoBanco(saida: string): Map<string, FuncaoDoBanco[]> {
  const mapa = new Map<string, FuncaoDoBanco[]>();
  for (const linha of saida.split("\n")) {
    const [esquema, nome, identidade = "", executa] = linha.split("|");
    if (!esquema || !nome) continue;
    const chave = `${esquema}.${nome}`;
    mapa.set(chave, [
      ...(mapa.get(chave) ?? []),
      { argumentos: nomesDosArgumentos(identidade), executa: executa === "true" },
    ]);
  }
  return mapa;
}
