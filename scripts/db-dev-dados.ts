// `pnpm db:dev-dados` (cerca de 200 ativos) e `pnpm db:carga` (5.000 ativos e a medição da lista):
// os dados de desenvolvimento do supabase/dev/dados.sql, SÓ no Supabase LOCAL. Recusa qualquer banco
// que não seja da própria máquina (nunca produção). Nunca imprime endereço nem chave: lê o
// `supabase status` por dentro. Fatia 3.9a.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
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

/** `--quantidade 5000 --medir --saida arquivo.md` */
export function lerArgumentos(argv: readonly string[]): {
  quantidade: number;
  medir: boolean;
  saida: string | null;
} {
  const valor = (nome: string) => {
    const i = argv.indexOf(nome);
    return i >= 0 ? (argv[i + 1] ?? null) : null;
  };
  const quantidade = Number(valor("--quantidade") ?? "200");
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 20000) {
    throw new Error("--quantidade vai de 1 a 20000.");
  }
  return { quantidade, medir: argv.includes("--medir"), saida: valor("--saida") };
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

/** As consultas medidas, como o app as faz (com a RLS de quem consulta). */
const CONSULTAS: { nome: string; sql: string }[] = [
  {
    nome: "lista, página 1 (25, por placa)",
    sql: "select nucleo.listar_placas('', '{}', '{}', '{}', false, 'placa', false, 1, 25)",
  },
  {
    nome: "lista filtrada por situação (PÁT)",
    sql: "select nucleo.listar_placas('', '{}', '{}', '{PÁT}', false, 'placa', false, 1, 25)",
  },
  {
    nome: "lista ordenada por dias na situação",
    sql: "select nucleo.listar_placas('', '{}', '{}', '{}', false, 'dias', true, 1, 25)",
  },
  {
    nome: "contagem dos chips",
    sql: "select * from nucleo.contar_chips_de_placas('', '{}', '{}', '{}', false)",
  },
  { nome: "detalhe de uma placa", sql: "select nucleo.detalhe_da_placa('DAA1A00')" },
];
const PLANOS: { nome: string; sql: string }[] = [
  {
    nome: "total da lista (placas_filtradas)",
    sql: "select count(*) from nucleo.placas_filtradas('', '{}', '{}', '{}', false)",
  },
  {
    nome: "filtro por situação (PÁT)",
    sql: "select count(*) from nucleo.placas_filtradas('', '{}', '{}', '{PÁT}', false)",
  },
];

async function medir(cliente: pg.Client): Promise<string> {
  const linhas: string[] = ["# Medição da lista de placas (modo banco)", ""];
  await cliente.query("begin");
  try {
    // Dois usuários de medição, só nesta transação: um Administrador e um gestor com carteira.
    const { rows } = await cliente.query<{ adm: string; gestor: string }>(`
      with adm as (
        insert into nucleo.pessoa (nome) values ('Medição Administrador') returning id
      ), doc as (
        insert into nucleo.pessoa_documento (pessoa_id, documento)
        select id, '52998224725' from adm returning pessoa_id
      ), u1 as (
        insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        values (gen_random_uuid(), 'authenticated', 'authenticated', 'medicao.adm@eixo.local', '{}', '{}', now(), now())
        returning id
      ), u2 as (
        insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        values (gen_random_uuid(), 'authenticated', 'authenticated', 'medicao.gestor@eixo.local', '{}', '{}', now(), now())
        returning id
      ), v1 as (
        insert into nucleo.usuario (pessoa_id, auth_user_id, perfil)
        select doc.pessoa_id, u1.id, 'administrador' from doc, u1 returning auth_user_id
      ), v2 as (
        insert into nucleo.usuario (pessoa_id, auth_user_id, perfil)
        select p.id, u2.id, 'gestor_de_frota' from nucleo.pessoa p, u2 where p.nome = 'Ana Ribeiro'
        returning auth_user_id
      )
      select (select auth_user_id from v1) as adm, (select auth_user_id from v2) as gestor`);
    const quem = rows[0]!;
    const { rows: contagem } = await cliente.query<{ n: string }>(
      "select count(*) as n from nucleo.ativo where excluido_em is null",
    );
    linhas.push(`Ativos no banco: ${contagem[0]!.n}.`, "");

    for (const [perfil, id] of [
      ["Administrador (vê tudo)", quem.adm],
      ["Gestor de frota (só a carteira)", quem.gestor],
    ] as const) {
      await cliente.query("savepoint como");
      await cliente.query(
        `select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true),
                set_config('request.jwt.claim.role', 'authenticated', true)`,
        [JSON.stringify({ sub: id, role: "authenticated" }), id],
      );
      await cliente.query("set local role authenticated");
      linhas.push(
        `## ${perfil}`,
        "",
        "| Consulta | Mediana (ms) | Mín. | Máx. |",
        "|---|---:|---:|---:|",
      );
      for (const consulta of CONSULTAS) {
        const tempos: number[] = [];
        for (let i = 0; i < 5; i++) {
          const inicio = performance.now();
          await cliente.query(consulta.sql);
          tempos.push(performance.now() - inicio);
        }
        tempos.sort((a, b) => a - b);
        linhas.push(
          `| ${consulta.nome} | ${Math.round(tempos[2]!)} | ${Math.round(tempos[0]!)} | ${Math.round(tempos[4]!)} |`,
        );
      }
      linhas.push("");
      for (const plano of PLANOS) {
        const { rows: explicado } = await cliente.query<{ "QUERY PLAN": string }>(
          `explain (analyze, buffers) ${plano.sql}`,
        );
        linhas.push(
          `### Plano: ${plano.nome}`,
          "",
          "```",
          ...explicado.map((r) => r["QUERY PLAN"]),
          "```",
          "",
        );
      }
      await cliente.query("rollback to savepoint como");
    }
  } finally {
    await cliente.query("rollback");
  }
  return linhas.join("\n");
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
    await cliente.query("begin");
    await cliente.query(readFileSync("supabase/dev/dados.sql", "utf8"));
    const { rows } = await cliente.query<{ resumo: string }>(
      "select pg_temp.gerar_dados($1) as resumo",
      [argumentos.quantidade],
    );
    await cliente.query("commit");
    console.log(`Dados de desenvolvimento: ${rows[0]!.resumo}`);
    if (argumentos.medir) {
      const relatorio = await medir(cliente);
      console.log(relatorio);
      if (argumentos.saida) writeFileSync(argumentos.saida, relatorio, "utf8");
    }
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
