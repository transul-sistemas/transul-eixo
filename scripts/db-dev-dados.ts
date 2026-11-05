// `pnpm db:dev-dados` (cerca de 200 ativos) e `pnpm db:carga` (5.000; a medição é o db-diagnostico.ts):
// os dados de desenvolvimento do supabase/dev/dados.sql, SÓ no Supabase LOCAL. Recusa qualquer banco
// que não seja da própria máquina (nunca produção). Nunca imprime endereço nem chave: lê o
// `supabase status` por dentro. Fatia 3.9a.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import pg from "pg";

/** Só o banco da própria máquina (o Supabase local no Docker). */
export function bancoLocal(endereco: string): boolean {
  let url: URL;
  try {
    url = new URL(endereco);
  } catch {
    return false;
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return false;
  return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
}

/** `--quantidade 5000` (200 por padrão). */
export function lerArgumentos(argv: readonly string[]): { quantidade: number } {
  const i = argv.indexOf("--quantidade");
  const quantidade = Number(i >= 0 ? (argv[i + 1] ?? "") : "200");
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 20000) {
    throw new Error("--quantidade vai de 1 a 20000.");
  }
  return { quantidade };
}

function enderecoDoBancoLocal(): string {
  const texto = execSync("pnpm exec supabase status -o env", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const linha = texto.split(/\r?\n/).find((l) => l.startsWith("DB_URL="));
  const endereco = linha?.replace(/^DB_URL="?/, "").replace(/"$/, "");
  if (!endereco)
    throw new Error("O supabase status não trouxe o banco: o Supabase local está ligado?");
  return endereco;
}

async function principal() {
  const argumentos = lerArgumentos(process.argv.slice(2));
  const endereco = enderecoDoBancoLocal();
  if (!bancoLocal(endereco)) {
    throw new Error("Recusado: os dados de desenvolvimento só rodam no Supabase local.");
  }
  const cliente = new pg.Client({ connectionString: endereco });
  await cliente.connect();
  try {
    const inicio = performance.now();
    await cliente.query("begin");
    await cliente.query(readFileSync("supabase/dev/dados.sql", "utf8"));
    const { rows } = await cliente.query<{ resumo: string }>(
      "select pg_temp.gerar_dados($1) as resumo",
      [argumentos.quantidade],
    );
    await cliente.query("commit");
    const segundos = Math.round((performance.now() - inicio) / 1000);
    console.log(`Dados de desenvolvimento: ${rows[0]!.resumo} Gerados em ${segundos} s.`);
  } catch (erro) {
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    await cliente.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
}
