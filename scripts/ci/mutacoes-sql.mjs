// Mutações nos guardas do SQL (fatia 3.9a), no Supabase LOCAL do runner do CI: aplica cada mutação na
// migration, recria o banco (`supabase db reset`), roda o pgTAP da leitura das placas e EXIGE que ele
// falhe. Uma mutação que passa é um guarda sem teste. Restaura a migration no fim de cada uma.
// Nunca imprime a saída do Supabase (que pode trazer chaves): só o resultado de cada mutação.
import { execSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const MIGRATION = "supabase/migrations/20261104200000_leitura_das_placas.sql";
const TESTE = "supabase/tests/80-leitura-das-placas.test.sql";

/** [nome, trecho original, trecho mutante, trocar todas as ocorrências?] */
const MUTACOES = [
  [
    "busca sem escapar o %",
    "replace(replace(replace(nucleo.texto_simples(btrim(coalesce(p_busca, ''))), '\\', '\\\\'), '%', '\\%'), '_', '\\_')",
    "nucleo.texto_simples(btrim(coalesce(p_busca, '')))",
  ],
  [
    "página sem limite de 100",
    "least(greatest(coalesce(p_tam, 25), 1), 100)",
    "greatest(coalesce(p_tam, 25), 1)",
  ],
  [
    "página além da última sem voltar à última",
    "least(greatest(coalesce(p_pagina, 1), 1), v_paginas)",
    "greatest(coalesce(p_pagina, 1), 1)",
  ],
  ["baixadas sempre na lista", "(coalesce(p_baixadas, false) or not v.baixada)", "true"],
  [
    "visão sem a RLS de quem consulta",
    "create view nucleo.linha_de_placa with (security_invoker = true) as",
    "create view nucleo.linha_de_placa as",
  ],
  [
    "chips de tipo sem ignorar o próprio grupo",
    "from nucleo.placas_filtradas(p_busca, p_grupos, '{}', p_siglas, p_baixadas) v",
    "from nucleo.placas_filtradas(p_busca, p_grupos, p_tipos, p_siglas, p_baixadas) v",
  ],
  ["ordem sem desempate pelo id", "nulls last, f.id", "nulls last", true],
  ["ordem fora da lista fechada", "else 'f.placa'", "else p_ordem"],
  [
    "história sem colapsar o que não mudou",
    "where m.sigla is distinct from m.anterior and m.sigla <> 'pendente'",
    "where m.sigla <> 'pendente'",
  ],
];

const silencioso = (comando) => {
  try {
    execSync(comando, { stdio: "ignore" });
    return 0;
  } catch (erro) {
    return erro.status ?? 1;
  }
};

const original = readFileSync(MIGRATION, "utf8");
const linhas = ["## Mutações no SQL (pgTAP 80)", "", "| Mutação | Resultado |", "|---|---|"];
let sobreviventes = 0;
try {
  for (const [nome, de, para, todas] of MUTACOES) {
    if (!original.includes(de)) {
      linhas.push(`| ${nome} | trecho não achado (mutação inválida) |`);
      sobreviventes += 1;
      continue;
    }
    writeFileSync(
      MIGRATION,
      todas ? original.replaceAll(de, para) : original.replace(de, para),
      "utf8",
    );
    const reset = silencioso("pnpm exec supabase db reset");
    const teste = reset === 0 ? silencioso(`pnpm exec supabase test db ${TESTE}`) : 0;
    const pega = reset !== 0 || teste !== 0;
    if (!pega) sobreviventes += 1;
    linhas.push(
      `| ${nome} | ${pega ? (reset !== 0 ? "pega (a migration recusa)" : "pega") : "SOBREVIVEU"} |`,
    );
  }
} finally {
  writeFileSync(MIGRATION, original, "utf8");
}
linhas.push("", `${MUTACOES.length - sobreviventes} de ${MUTACOES.length} pegas.`);
const relatorio = linhas.join("\n");
console.log(relatorio);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${relatorio}\n`);
process.exit(sobreviventes === 0 ? 0 : 1);
