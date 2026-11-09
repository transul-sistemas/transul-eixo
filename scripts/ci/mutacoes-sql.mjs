// Mutações nos guardas do SQL (fatias 3.9a e 3.9b-1), no Supabase LOCAL do runner do CI: aplica cada
// mutação na migration, recria o banco (`supabase db reset`), roda o pgTAP da leitura das placas e EXIGE
// que ele falhe. Uma mutação que passa é um guarda sem teste. Restaura a migration no fim de cada uma.
// Nunca imprime a saída do Supabase (que pode trazer chaves): só o resultado de cada mutação.
//
// Proteção (09/11/2026): antes de qualquer reset, cada mutação é conferida. Ela é INVÁLIDA (e o script
// falha sem rodar nada) se o trecho não existir no arquivo-alvo, se o mesmo trecho aparecer numa
// migration posterior, ou se uma migration posterior recriar, alterar ou apagar o objeto mutado. Foi o
// que aconteceu na 3.9b-1: ela recriou listar_placas, placas_filtradas, contar_chips_de_placas e a
// política leitura_da_placa_ler, e as mutações nas versões antigas "sobreviviam" sem testar nada.
//
// `node scripts/ci/mutacoes-sql.mjs --conferir` só faz essa conferência (não toca o banco nem os arquivos).
import { spawn } from "node:child_process";
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const PASTA = "supabase/migrations";
const LEITURA = `${PASTA}/20261104200000_leitura_das_placas.sql`;
const MANTIDA = `${PASTA}/20261105100000_leitura_mantida_das_placas.sql`;
const RELOGIO = `${PASTA}/20261105120000_leitura_mantida_relogio.sql`;
const GRAVAR = `${PASTA}/20261106200000_gravar_pelo_banco.sql`;
const TESTES =
  "supabase/tests/80-leitura-das-placas.test.sql supabase/tests/81-leitura-mantida.test.sql";
const FONTES = [
  "ativo",
  "placa_do_ativo",
  "gestor_da_carteira",
  "cr_do_ativo",
  "placa_na_operacao",
  "custodia",
  "estado_de_status",
  "composicao",
  "cr",
  "pessoa",
  "operacao",
];

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** O que, numa migration posterior, substitui o objeto mutado (e tornaria a mutação inócua). */
const funcao = (nome) => [
  new RegExp(
    `\\b(create(\\s+or\\s+replace)?|alter|drop)\\s+function\\s+(if\\s+exists\\s+)?${escapar(nome)}\\s*\\(`,
    "i",
  ),
];
const funcaoEPermissoes = (nome) => [
  ...funcao(nome),
  new RegExp(`\\b(grant|revoke)\\s[^;]*\\bon\\s+function\\s+${escapar(nome)}\\s*\\(`, "i"),
];
const visao = (nome) => [
  new RegExp(
    `\\b(create(\\s+or\\s+replace)?|alter|drop)\\s+view\\s+(if\\s+exists\\s+)?${escapar(nome)}\\b`,
    "i",
  ),
];
const politica = (nome) => [
  new RegExp(`\\b(create|alter|drop)\\s+policy\\s+(if\\s+exists\\s+)?${escapar(nome)}\\b`, "i"),
];
const gatilho = (nome, tabela) => [
  new RegExp(
    `\\b(create\\s+(constraint\\s+)?trigger|drop\\s+trigger\\s+(if\\s+exists\\s+)?)${escapar(nome)}\\b[^;]*\\bon\\s+${escapar(tabela)}\\b`,
    "i",
  ),
];

/**
 * nome · de (trecho original) · para (trecho mutante) · todas (trocar todas as ocorrências) ·
 * arquivo (migration mais recente que define o objeto) · objeto (o que a substituiria depois)
 */
const MUTACOES = [
  {
    nome: "busca sem escapar o %",
    de: "replace(replace(replace(nucleo.texto_simples(btrim(coalesce(p_busca, ''))), '\\', '\\\\'), '%', '\\%'), '_', '\\_')",
    para: "nucleo.texto_simples(btrim(coalesce(p_busca, '')))",
    arquivo: GRAVAR,
    objeto: funcao("nucleo.placas_filtradas"),
  },
  {
    nome: "página sem limite de 100",
    de: "least(greatest(coalesce(p_tam, 25), 1), 100)",
    para: "greatest(coalesce(p_tam, 25), 1)",
    arquivo: GRAVAR,
    objeto: funcao("nucleo.listar_placas"),
  },
  {
    nome: "página além da última sem voltar à última",
    de: "least(greatest(coalesce(p_pagina, 1), 1), v_paginas)",
    para: "greatest(coalesce(p_pagina, 1), 1)",
    arquivo: GRAVAR,
    objeto: funcao("nucleo.listar_placas"),
  },
  {
    nome: "baixadas sempre na lista",
    de: "(coalesce(p_baixadas, false) or not v.baixada)",
    para: "true",
    arquivo: GRAVAR,
    objeto: funcao("nucleo.placas_filtradas"),
  },
  {
    nome: "visão sem a RLS de quem consulta",
    de: "create or replace view nucleo.linha_de_placa with (security_invoker = true) as",
    para: "create or replace view nucleo.linha_de_placa as",
    arquivo: MANTIDA,
    objeto: visao("nucleo.linha_de_placa"),
  },
  {
    nome: "política da leitura mantida afrouxada (gestor vê qualquer carteira)",
    de: "or gestor_id = (select config.minha_carteira_de_placas())",
    para: "or true",
    arquivo: GRAVAR,
    objeto: politica("leitura_da_placa_ler"),
  },
  {
    nome: "linhas vencidas nunca recalculadas",
    de: "where l.proximo_recalculo <= p_em",
    para: "where false",
    arquivo: RELOGIO,
    objeto: funcao("nucleo.recalcular_linhas_vencidas"),
  },
  {
    nome: "recálculo com relógio liberado para quem entrou",
    de: "grant execute on function nucleo.atualizar_leitura_vencida() to authenticated;",
    para: "grant execute on function nucleo.atualizar_leitura_vencida() to authenticated;\ngrant execute on function nucleo.recalcular_linhas_vencidas(integer, timestamptz) to authenticated;",
    arquivo: RELOGIO,
    objeto: funcaoEPermissoes("nucleo.recalcular_linhas_vencidas"),
  },
  ...FONTES.map((tabela) => ({
    nome: `sem o gatilho de ${tabela}`,
    de: `create constraint trigger t99_leitura_da_placa after insert or update on nucleo.${tabela}
  deferrable initially deferred for each row execute function nucleo.recalcular_pela_mudanca();
`,
    para: "",
    arquivo: MANTIDA,
    objeto: gatilho("t99_leitura_da_placa", `nucleo.${tabela}`),
  })),
  {
    nome: "chips de tipo sem ignorar o próprio grupo",
    de: "from nucleo.placas_filtradas(p_busca, p_grupos, '{}', p_siglas, p_baixadas, p_para_receber) v",
    para: "from nucleo.placas_filtradas(p_busca, p_grupos, p_tipos, p_siglas, p_baixadas, p_para_receber) v",
    arquivo: GRAVAR,
    objeto: funcao("nucleo.contar_chips_de_placas"),
  },
  {
    nome: "ordem sem desempate pelo id",
    de: "nulls last, f.id",
    para: "nulls last",
    todas: true,
    arquivo: GRAVAR,
    objeto: funcao("nucleo.listar_placas"),
  },
  {
    nome: "ordem fora da lista fechada",
    de: "else 'f.placa'",
    para: "else p_ordem",
    arquivo: GRAVAR,
    objeto: funcao("nucleo.listar_placas"),
  },
  {
    nome: "história sem colapsar o que não mudou",
    de: "where m.sigla is distinct from m.anterior and m.sigla <> 'pendente'",
    para: "where m.sigla <> 'pendente'",
    arquivo: LEITURA,
    objeto: funcao("nucleo.historia_da_placa"),
  },
];

const migrations = readdirSync(PASTA)
  .filter((nome) => nome.endsWith(".sql"))
  .sort()
  .map((nome) => `${PASTA}/${nome}`);
const textos = new Map(migrations.map((arquivo) => [arquivo, readFileSync(arquivo, "utf8")]));
const ocorrencias = (texto, trecho) => texto.split(trecho).length - 1;

/** Devolve o motivo de a mutação ser inválida, ou null se ela atinge o código que vale no banco. */
const motivoDeInvalidez = ({ de, para, todas, arquivo, objeto }) => {
  const original = textos.get(arquivo);
  if (original === undefined) return `arquivo-alvo não existe (${arquivo})`;
  const n = ocorrencias(original, de);
  if (n === 0) return "trecho não achado no arquivo-alvo";
  if (n > 1 && !todas) return `trecho ambíguo (${n} ocorrências)`;
  if ((todas ? original.replaceAll(de, para) : original.replace(de, para)) === original)
    return "a mutação não muda o arquivo";
  for (const posterior of migrations.filter((m) => m > arquivo)) {
    const texto = textos.get(posterior);
    const curto = posterior.slice(PASTA.length + 1);
    if (texto.includes(de)) return `trecho repetido em migration posterior (${curto})`;
    if (objeto.some((padrao) => padrao.test(texto)))
      return `objeto substituído em migration posterior (${curto})`;
  }
  return null;
};

const invalidas = MUTACOES.map((m) => [m.nome, motivoDeInvalidez(m)]).filter(
  ([, motivo]) => motivo,
);
const relatar = (linhas, codigo) => {
  const relatorio = linhas.join("\n");
  console.log(relatorio);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${relatorio}\n`);
  process.exit(codigo);
};

if (invalidas.length > 0 || process.argv.includes("--conferir")) {
  relatar(
    [
      "## Mutações no SQL: conferência dos alvos",
      "",
      "| Mutação | Alvo |",
      "|---|---|",
      ...MUTACOES.map((m) => {
        const motivo = invalidas.find(([nome]) => nome === m.nome)?.[1];
        return `| ${m.nome} | ${motivo ? `INVÁLIDA: ${motivo}` : m.arquivo.slice(PASTA.length + 1)} |`;
      }),
      "",
      `${MUTACOES.length - invalidas.length} de ${MUTACOES.length} válidas.`,
    ],
    invalidas.length === 0 ? 0 : 1,
  );
}

const RESET = "pnpm exec supabase db reset";
const TESTE = `pnpm exec supabase test db ${TESTES}`;

// Assíncrono (não execSync): com o laço de eventos livre, o SIGINT e o SIGTERM são tratados na hora,
// no meio de um reset, e não só quando todas as mutações terminam.
let filhoAtual = null;
const silencioso = (comando) =>
  new Promise((resolver) => {
    filhoAtual = spawn(comando, { shell: true, stdio: "ignore" });
    filhoAtual.on("error", () => resolver(1));
    filhoAtual.on("exit", (codigo, sinal) => resolver(codigo ?? (sinal ? 1 : 0)));
  }).finally(() => {
    filhoAtual = null;
  });

/** As migrations que podem estar diferentes do original agora (marcadas ANTES de escrever). */
const alterados = new Set();
const mutar = (arquivo, texto) => {
  alterados.add(arquivo);
  writeFileSync(arquivo, texto, "utf8");
};
/** Restaura cada arquivo alterado; devolve os que não deu para restaurar. Pode ser chamada de novo. */
const restaurar = () => {
  const falhas = [];
  for (const arquivo of [...alterados]) {
    try {
      writeFileSync(arquivo, textos.get(arquivo), "utf8");
      alterados.delete(arquivo);
    } catch {
      falhas.push(arquivo);
    }
  }
  return falhas;
};
const avisarFalhas = (falhas) => {
  if (falhas.length > 0)
    console.error(
      `ATENÇÃO: não foi possível restaurar; podem ter ficado alterados: ${falhas.join(", ")} (confira com git status)`,
    );
};

// Um tratador só, por flag: o segundo sinal (ou o mesmo sinal repetido) não restaura de novo.
let encerrando = false;
const aoSinal = (sinal, codigo) => {
  if (encerrando) return;
  encerrando = true;
  const falhas = restaurar();
  if (filhoAtual) filhoAtual.kill(sinal);
  if (falhas.length === 0)
    console.error(`Interrompido por ${sinal}: as migrations foram restauradas.`);
  avisarFalhas(falhas);
  process.exit(codigo);
};
process.on("SIGINT", () => aoSinal("SIGINT", 130));
process.on("SIGTERM", () => aoSinal("SIGTERM", 143));

// O banco original tem de subir e passar no pgTAP antes de qualquer mutação: sem isso, uma falha de
// infraestrutura (Supabase fora do ar, reset quebrado) seria contada como mutação "pega".
const abortar = (etapa, codigo) =>
  relatar(
    [
      "## Mutações no SQL: banco original",
      "",
      `ABORTADO: ${etapa} com as migrations originais falhou (código ${codigo}).`,
      "Falha de infraestrutura ou do próprio banco: nenhuma mutação foi aplicada nem contada.",
    ],
    2,
  );
const resetOriginal = await silencioso(RESET);
if (resetOriginal !== 0) abortar("o `supabase db reset`", resetOriginal);
const testeOriginal = await silencioso(TESTE);
if (testeOriginal !== 0) abortar("o pgTAP (80 e 81)", testeOriginal);

const linhas = ["## Mutações no SQL (pgTAP 80 e 81)", "", "| Mutação | Resultado |", "|---|---|"];
let sobreviventes = 0;
try {
  for (const { nome, de, para, todas, arquivo } of MUTACOES) {
    const original = textos.get(arquivo);
    mutar(arquivo, todas ? original.replaceAll(de, para) : original.replace(de, para));
    const reset = await silencioso(RESET);
    const teste = reset === 0 ? await silencioso(TESTE) : 0;
    const pega = reset !== 0 || teste !== 0;
    if (!pega) sobreviventes += 1;
    linhas.push(
      `| ${nome} | ${pega ? (reset !== 0 ? "pega (a migration recusa)" : "pega") : "SOBREVIVEU"} |`,
    );
    avisarFalhas(restaurar());
  }
} finally {
  avisarFalhas(restaurar());
}
linhas.push("", `${MUTACOES.length - sobreviventes} de ${MUTACOES.length} pegas.`);
relatar(linhas, sobreviventes === 0 ? 0 : 1);
