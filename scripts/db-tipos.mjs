// Gera lib/dados/tipos-do-banco.ts a partir do banco LOCAL (supabase start). Roda só no Docker local:
// nunca fala com projeto na nuvem. Uso: pnpm db:tipos
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const resultado = spawnSync("pnpm exec supabase gen types typescript --local", {
  encoding: "utf-8",
  shell: true,
});
if (resultado.status !== 0) {
  process.stderr.write(resultado.stderr ?? "");
  process.exit(resultado.status ?? 1);
}

const cabecalho = [
  "// Arquivo gerado por `pnpm db:tipos` a partir do banco local. NÃO edite à mão.",
  "// Para atualizar: `pnpm exec supabase start` e `pnpm db:tipos`. O CI falha se estiver defasado.",
  "",
  "",
].join("\n");

writeFileSync("lib/dados/tipos-do-banco.ts", cabecalho + resultado.stdout.replace(/\r\n/g, "\n"));
process.stdout.write("lib/dados/tipos-do-banco.ts atualizado.\n");
