// `pnpm importar:cr -- <csv> [--simular|--aplicar]` (fatia 3.9c): os CRs da "Auditoria de Centros de
// Resultado" do Sankhya (CSV UTF-8 com ponto e vírgula, em importacao/, fora do Git) para o banco LOCAL.
//  * Idempotente pelo código do CR (CODCENCUS): repetir não cria nada nem muda versão do que já é igual.
//  * --simular (o padrão) faz a carga inteira numa transação e desfaz no fim; --aplicar confirma. Os dois
//    só no Supabase local (recusa qualquer outro banco).
//  * A tela mostra só agregados: nunca nome de CR, de operação ou de acionista, nem código.
//  * Carga do dono do banco: o gatilho da leitura mantida fica desligado na transação, a leitura é
//    reconstruída no fim e o gatilho volta antes do commit (regra de 05/11/2026).
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { bancoLocal, enderecoDoBancoLocal } from "./banco-local.ts";

export class ErroDaImportacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDaImportacao";
  }
}

const USO = "Uso: pnpm importar:cr -- importacao/<arquivo>.csv [--simular|--aplicar]";

export function lerArgumentos(argv: readonly string[]): { arquivo: string; aplicar: boolean } {
  const resto = argv.filter((a) => a !== "--");
  const arquivos = resto.filter((a) => !a.startsWith("--"));
  const opcoes = resto.filter((a) => a.startsWith("--"));
  if (arquivos.length !== 1 || opcoes.length > 1) throw new ErroDaImportacao(USO);
  const [opcao] = opcoes;
  if (opcao !== undefined && opcao !== "--simular" && opcao !== "--aplicar")
    throw new ErroDaImportacao(USO);
  return { arquivo: arquivos[0] as string, aplicar: opcao === "--aplicar" };
}

export interface LinhaDeCr {
  codcencus: number;
  nome: string;
  bloqueado: "S" | "N";
  gerencial: string | null;
  operacao: string | null;
  filial: string | null;
  codcencusPai: number | null;
  nomePai: string | null;
  frota: "S" | "N";
}

const COLUNAS = {
  bloqueado: "Bloqueado",
  codigo: "Cód. Centro de Resultado",
  nome: "Centro de Resultado",
  gerencial: "Gerencial",
  operacao: "Operação",
  filial: "Filial",
  codigoPai: "Cód. Centro de Resultado Pai",
  nomePai: "Centro de Resultado Pai",
  frota: "Frota",
} as const;

/** Separa as linhas e os campos (ponto e vírgula, aspas duplas com "" dentro, CRLF ou LF). */
function linhasDoCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

function simNao(valor: string, coluna: string, numero: number): "S" | "N" {
  if (valor === "Sim") return "S";
  if (valor === "Não") return "N";
  throw new ErroDaImportacao(`A coluna ${coluna} da linha ${numero} deveria ser Sim ou Não.`);
}

function codigo(valor: string, coluna: string, numero: number): number {
  if (!/^\d{1,12}$/.test(valor)) {
    throw new ErroDaImportacao(`A coluna ${coluna} da linha ${numero} deveria ser um número.`);
  }
  return Number(valor);
}

export function lerCsvDeCr(texto: string): LinhaDeCr[] {
  const linhas = linhasDoCsv(texto.replace(/^﻿/, ""));
  const posicao = linhas.findIndex((l) => l.map((c) => c.trim()).includes(COLUNAS.codigo));
  if (posicao < 0) throw new ErroDaImportacao(`O arquivo não tem o cabeçalho "${COLUNAS.codigo}".`);
  const cabecalho = (linhas[posicao] as string[]).map((c) => c.trim());
  const indice = Object.fromEntries(
    Object.entries(COLUNAS).map(([chave, nome]) => {
      const i = cabecalho.indexOf(nome);
      if (i < 0) throw new ErroDaImportacao(`O cabeçalho não tem a coluna "${nome}".`);
      return [chave, i];
    }),
  ) as Record<keyof typeof COLUNAS, number>;

  const vistos = new Set<number>();
  const saida: LinhaDeCr[] = [];
  linhas.slice(posicao + 1).forEach((l, i) => {
    const numero = posicao + i + 2;
    if (l.every((c) => c.trim() === "")) return;
    const v = (chave: keyof typeof COLUNAS) => (l[indice[chave]] ?? "").trim();
    const nulo = (chave: keyof typeof COLUNAS) => v(chave) || null;
    const codcencus = codigo(v("codigo"), COLUNAS.codigo, numero);
    if (vistos.has(codcencus))
      throw new ErroDaImportacao(`Código de CR repetido na linha ${numero}.`);
    vistos.add(codcencus);
    // O Sankhya marca a raiz com pai negativo (-999999999): sem pai.
    const semPai = v("codigoPai") === "" || /^-\d+$/.test(v("codigoPai"));
    saida.push({
      codcencus,
      nome: v("nome"),
      bloqueado: simNao(v("bloqueado"), COLUNAS.bloqueado, numero),
      gerencial: nulo("gerencial"),
      operacao: nulo("operacao"),
      filial: nulo("filial"),
      codcencusPai: semPai ? null : codigo(v("codigoPai"), COLUNAS.codigoPai, numero),
      nomePai: semPai ? null : nulo("nomePai"),
      frota: simNao(v("frota"), COLUNAS.frota, numero),
    });
  });
  return saida;
}

export interface ResumoDaImportacao {
  modo: "simulação" | "aplicação";
  linhas: number;
  novos: number;
  atualizados: number;
  iguais: number;
  paisCriados: number;
  porUnidade: Record<string, number>;
  porGaragem: Record<string, number>;
  operacao: Record<string, number>;
  excecoes: Record<string, number>;
}

function contagens(titulo: string, valores: Record<string, number>): string {
  const partes = Object.entries(valores)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, n]) => `${k}: ${n}`);
  return `${titulo}: ${partes.length > 0 ? partes.join(", ") : "nenhum"}`;
}

/** Só agregados: contagens por categoria do Eixo, nunca nomes nem códigos. */
export function textoDoResumo(r: ResumoDaImportacao): string {
  return [
    `Importação de CRs (${r.modo}${r.modo === "simulação" ? ": nada foi gravado" : ""})`,
    `Linhas lidas: ${r.linhas}`,
    `CRs: novos ${r.novos}, atualizados ${r.atualizados}, iguais ${r.iguais}; agrupadores (pai) criados ${r.paisCriados}`,
    contagens("Por unidade gerencial", r.porUnidade),
    contagens("Por garagem", r.porGaragem),
    contagens("Operação", r.operacao),
    contagens("Exceções abertas por assunto", r.excecoes),
  ].join("\n");
}

// A carga inteira, numa transação, a partir das linhas em JSON (na configuração eixo.importacao_cr, local à
// transação: o texto com vários comandos não aceita parâmetro). Cada CR é casado pelo CODCENCUS;
// unidade, garagem e operação, pelos rótulos do Sankhya guardados nos catálogos do Eixo.
const SQL_DA_CARGA = `
create temporary table importacao_cr on commit drop as
select x.*,
       u.codigo as unidade,
       g.id as garagem_id,
       o.id as operacao_id
  from jsonb_to_recordset(current_setting('eixo.importacao_cr')::jsonb) as x (
         codcencus bigint, nome text, bloqueado text, gerencial text, operacao text, filial text,
         "codcencusPai" bigint, "nomePai" text, frota text)
  left join config.unidade_gerencial u on u.rotulo_no_sankhya = x.gerencial
  left join config.garagem g on g.codigo = case x.filial when 'Matriz' then 'matriz'
                                                         when 'Cordeirópolis/SP' then 'cordeiropolis'
                                                         when 'Parauapebas/PA' then 'parauapebas' end
  left join nucleo.operacao o on o.rotulo_no_sankhya = x.operacao and o.excluido_em is null;

create temporary table resultado_cr (codcencus bigint primary key, acao text not null) on commit drop;

-- Os agrupadores (pai) que não vieram como linha e ainda não existem.
with pais as (
  select distinct on ("codcencusPai") "codcencusPai" as codcencus, "nomePai" as nome
    from importacao_cr
   where "codcencusPai" is not null
     and "codcencusPai" not in (select codcencus from importacao_cr)
   order by "codcencusPai"
), novos as (
  insert into nucleo.cr (codcencus, codigo, nome, analitico, analitico_origem)
  select p.codcencus, p.codcencus::text, p.nome, false, 'sankhya'
    from pais p
   where not exists (select 1 from nucleo.cr c where c.codcencus = p.codcencus)
  returning codcencus
)
insert into resultado_cr (codcencus, acao) select codcencus, 'pai' from novos;

-- Os CRs que mudaram (ou são novos): o valor do Sankhya, com origem sankhya.
with valores as (
  select i.codcencus, i.codcencus::text as codigo, nullif(i.nome, '') as nome, i.unidade, i.frota as ad_frota,
         i.bloqueado as ad_bloqueado, i.garagem_id, i.operacao_id, p.id as cr_pai_id
    from importacao_cr i
    left join nucleo.cr p on p.codcencus = i."codcencusPai"
), atualizados as (
  update nucleo.cr c
     set nome = v.nome,
         unidade_gerencial = v.unidade,
         unidade_gerencial_origem = case when v.unidade is null then null else 'sankhya'::config.origem_do_campo end,
         ad_frota = v.ad_frota, ad_frota_origem = 'sankhya',
         ad_bloqueado = v.ad_bloqueado, ad_bloqueado_origem = 'sankhya',
         garagem_id = coalesce(v.garagem_id, c.garagem_id),
         garagem_origem = case when v.garagem_id is not null then 'sankhya'::config.origem_do_campo else c.garagem_origem end,
         garagem_conferencia = case when v.garagem_id is not null then 'conferida' else c.garagem_conferencia end,
         operacao_id = v.operacao_id,
         cr_pai_id = v.cr_pai_id,
         analitico = true, analitico_origem = 'sankhya'
    from valores v
   where c.codcencus = v.codcencus
     and (c.nome, c.unidade_gerencial, c.ad_frota, c.ad_bloqueado, c.operacao_id, c.cr_pai_id, c.analitico)
         is distinct from (v.nome, v.unidade, v.ad_frota, v.ad_bloqueado, v.operacao_id, v.cr_pai_id, true)
      or (c.codcencus = v.codcencus and v.garagem_id is not null and c.garagem_id is distinct from v.garagem_id)
  returning c.codcencus
), novos as (
  insert into nucleo.cr (codcencus, codigo, nome, unidade_gerencial, unidade_gerencial_origem, ad_frota, ad_frota_origem,
                         ad_bloqueado, ad_bloqueado_origem, garagem_id, garagem_origem, garagem_conferencia,
                         operacao_id, cr_pai_id, analitico, analitico_origem)
  select v.codcencus, v.codigo, v.nome, v.unidade, case when v.unidade is null then null else 'sankhya'::config.origem_do_campo end,
         v.ad_frota, 'sankhya', v.ad_bloqueado, 'sankhya',
         v.garagem_id, case when v.garagem_id is null then null else 'sankhya'::config.origem_do_campo end,
         case when v.garagem_id is null then null else 'conferida' end,
         v.operacao_id, v.cr_pai_id, true, 'sankhya'
    from valores v
   where not exists (select 1 from nucleo.cr c where c.codcencus = v.codcencus)
  returning codcencus
)
insert into resultado_cr (codcencus, acao)
select codcencus, 'atualizado' from atualizados
union all
select codcencus, 'novo' from novos;

-- O que não se deduz vai para a fila (uma aberta por CR e assunto).
insert into nucleo.fila_de_excecoes (cr_id, assunto, descricao)
select c.id, e.assunto, e.descricao
  from importacao_cr i
  join nucleo.cr c on c.codcencus = i.codcencus
  cross join lateral (
    select 'cr_sem_unidade_gerencial' as assunto,
           format('O CR %s veio do Sankhya sem a unidade gerencial (ou com uma que o Eixo não conhece). Confira o Gerencial no Sankhya.', i.codcencus) as descricao
     where i.unidade is null
    union all
    select 'cr_operacao_desconhecida',
           format('A operação do CR %s no Sankhya não casa com nenhuma operação do Eixo. Cadastre a operação ou corrija o CR no Sankhya.', i.codcencus)
     where i.operacao is not null and i.operacao_id is null and i.operacao not like 'Acionista %'
    union all
    select 'cr_filial_desconhecida',
           format('A filial do CR %s no Sankhya não é uma das 3 garagens. Confira no Sankhya.', i.codcencus)
     where i.filial is not null and i.garagem_id is null
  ) e
on conflict (cr_id, assunto) where resolvida_em is null and cr_id is not null do nothing;
`;

const SQL_DO_RESUMO = `
select jsonb_build_object(
  'novos', (select count(*) from resultado_cr where acao = 'novo'),
  'atualizados', (select count(*) from resultado_cr where acao = 'atualizado'),
  'paisCriados', (select count(*) from resultado_cr where acao = 'pai'),
  'porUnidade', (select coalesce(jsonb_object_agg(k, n), '{}') from (
      select coalesce(unidade, 'sem_unidade') k, count(*) n from importacao_cr group by 1) t),
  'porGaragem', (select coalesce(jsonb_object_agg(k, n), '{}') from (
      select coalesce(g.codigo, 'sem_garagem') k, count(*) n
        from importacao_cr i join nucleo.cr c on c.codcencus = i.codcencus
        left join config.garagem g on g.id = c.garagem_id group by 1) t),
  'operacao', (select coalesce(jsonb_object_agg(k, n), '{}') from (
      select case when operacao_id is not null then 'casada'
                  when operacao is null then 'vazia'
                  when operacao like 'Acionista %' then 'acionista'
                  else 'desconhecida' end k, count(*) n
        from importacao_cr group by 1) t),
  'excecoes', (select coalesce(jsonb_object_agg(k, n), '{}') from (
      select f.assunto k, count(*) n
        from nucleo.fila_de_excecoes f join nucleo.cr c on c.id = f.cr_id
       where f.resolvida_em is null and c.codcencus in (select codcencus from importacao_cr)
       group by 1) t)
) as resumo`;

/** A carga dos CRs dentro de uma transação já aberta por quem chama (a carga inicial da v1 a usa). Os
 * temporários somem no commit ou no rollback de quem chama. */
export async function carregarCrsNaTransacao(
  cliente: pg.Client,
  linhas: readonly LinhaDeCr[],
): Promise<Omit<ResumoDaImportacao, "modo" | "linhas" | "iguais">> {
  await cliente.query("alter table nucleo.cr disable trigger t99_leitura_da_placa");
  await cliente.query("select set_config('eixo.importacao_cr', $1, true)", [
    JSON.stringify(linhas),
  ]);
  await cliente.query(SQL_DA_CARGA);
  const { rows } = await cliente.query<{
    resumo: Omit<ResumoDaImportacao, "modo" | "linhas" | "iguais">;
  }>(SQL_DO_RESUMO);
  await cliente.query("select nucleo.reconstruir_leitura_das_placas()");
  await cliente.query("alter table nucleo.cr enable trigger t99_leitura_da_placa");
  const r = rows[0]?.resumo;
  if (!r) throw new ErroDaImportacao("O banco não devolveu o resumo da importação.");
  return r;
}

export async function importar(
  cliente: pg.Client,
  linhas: readonly LinhaDeCr[],
  aplicar: boolean,
): Promise<ResumoDaImportacao> {
  await cliente.query("begin");
  try {
    const r = await carregarCrsNaTransacao(cliente, linhas);
    await cliente.query(aplicar ? "commit" : "rollback");
    return {
      modo: aplicar ? "aplicação" : "simulação",
      linhas: linhas.length,
      ...r,
      iguais: linhas.length - r.novos - r.atualizados,
    };
  } catch (erro) {
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  }
}

async function principal() {
  const { arquivo, aplicar } = lerArgumentos(process.argv.slice(2));
  const linhas = lerCsvDeCr(readFileSync(arquivo, "utf8"));
  const endereco = enderecoDoBancoLocal();
  if (!bancoLocal(endereco))
    throw new ErroDaImportacao("Recusado: a importação só roda no Supabase local.");
  const cliente = new pg.Client({ connectionString: endereco });
  await cliente.connect();
  try {
    console.log(textoDoResumo(await importar(cliente, linhas, aplicar)));
  } finally {
    await cliente.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((erro: unknown) => {
    // Só a mensagem do Eixo ou do Postgres; nunca o endereço do banco.
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error(mensagem.replace(/postgres(ql)?:\/\/\S+/g, "[endereço oculto]"));
    process.exit(1);
  });
}
