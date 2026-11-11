// `pnpm db:paridade`: confere no banco LOCAL (só leitura: pg_proc) que cada função que o app chama (.rpc)
// existe com os mesmos argumentos e que `authenticated` pode executá-la. Imprime só nomes de função e de
// esquema. Sai com 1 se algo faltar (aplique as migrations). O contêiner do banco é `supabase_db_<project_id>`
// (project_id do supabase/config.toml), o mesmo no `supabase start` local e no CI.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { arquivosDoApp } from "../lib/paridade/arquivos-do-app.ts";
import {
  compararParidade,
  conteinerDoBanco,
  lerDoBanco,
  funcoesDosTipos,
  relatorioDeParidade,
  usosDoApp,
} from "../lib/paridade/paridade.ts";

const SQL = `select n.nspname || '|' || p.proname || '|' || pg_get_function_identity_arguments(p.oid) || '|' ||
  has_function_privilege('authenticated', p.oid, 'execute')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('nucleo', 'config')`;

function principal(): number {
  const usos = usosDoApp(arquivosDoApp(process.cwd()));
  const tipos = funcoesDosTipos(readFileSync("lib/dados/tipos-do-banco.ts", "utf8"));
  let saida: string;
  try {
    saida = execFileSync(
      "docker",
      [
        "exec",
        conteinerDoBanco(readFileSync("supabase/config.toml", "utf8")),
        "psql",
        "-U",
        "postgres",
        "-tAc",
        SQL,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch {
    console.error(
      "paridade: não consegui ler o banco local (contêiner parado?). Suba com: pnpm exec supabase start",
    );
    return 2;
  }
  const problemas = compararParidade(usos, tipos, lerDoBanco(saida));
  const texto = relatorioDeParidade(problemas, usos.length);
  if (problemas.length > 0) console.error(texto);
  else console.log(texto);
  return problemas.length > 0 ? 1 : 0;
}

process.exitCode = principal();
