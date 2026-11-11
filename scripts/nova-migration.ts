// Cria uma migration vazia com o timestamp SEMPRE depois da última da pasta (a maior + 1 hora), nunca
// a data de hoje: a ordem de aplicação no banco é a ordem dos nomes. Uso: pnpm db:nova-migration nome_em_snake_case
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const NOME = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const ARQUIVO = /^(\d{14})_.+\.sql$/;

export function nomeValido(nome: string): boolean {
  return NOME.test(nome);
}

function paraData(ts: string): Date {
  return new Date(
    Date.UTC(
      Number(ts.slice(0, 4)),
      Number(ts.slice(4, 6)) - 1,
      Number(ts.slice(6, 8)),
      Number(ts.slice(8, 10)),
      Number(ts.slice(10, 12)),
      Number(ts.slice(12, 14)),
    ),
  );
}

function paraTimestamp(d: Date): string {
  const p = (n: number, t = 2) => String(n).padStart(t, "0");
  return `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

/** O timestamp da próxima migration: a maior da pasta mais uma hora. */
export function proximoTimestamp(arquivos: readonly string[]): string {
  const todos = arquivos.flatMap((a) => ARQUIVO.exec(a)?.[1] ?? []);
  if (todos.length === 0) throw new Error("A pasta de migrations está vazia.");
  const maior = todos.reduce((a, b) => (a > b ? a : b));
  return paraTimestamp(new Date(paraData(maior).getTime() + 3_600_000));
}

export function criarMigration(pasta: string, nome: string): string {
  if (!nomeValido(nome)) {
    throw new Error(
      `Nome inválido: "${nome}". Use letras minúsculas, números e sublinhado (snake_case), por exemplo corte_do_dia_10.`,
    );
  }
  const caminho = join(pasta, `${proximoTimestamp(readdirSync(pasta))}_${nome}.sql`);
  if (existsSync(caminho)) throw new Error(`Já existe ${caminho}.`);
  writeFileSync(caminho, `-- ${nome.replaceAll("_", " ")}\n\n`, "utf-8");
  return caminho;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.stdout.write(`${criarMigration("supabase/migrations", process.argv[2] ?? "")}\n`);
  } catch (erro) {
    process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
    process.exit(1);
  }
}
