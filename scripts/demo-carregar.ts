// `pnpm demo:carregar [--ensaio]`: acrescenta dados FICTÍCIOS de demonstração ao Supabase LOCAL, para ver
// as telas hoje vazias (Operacional, Pessoas e Escala, Parceiros e Locação, Abastecimento,
// Acompanhamento, "Para receber"). Veja docs/demonstracao.md (backup do REAL antes, restauração depois).
//  * Roda como o dono do banco, numa transação só, e usa só as funções atômicas e os caminhos legítimos
//    (cadastrar_ativo, engatar, entregar_ao_operacional, registrar_chegada, avancar_no_patio,
//    criar_ordem_de_carregamento, lancar_situacao_do_dia, disponibilizar_placa, cadastrar_pessoa,
//    marcar_escala, cadastrar_parceiro, cadastrar_locacao). Como várias exigem permissão, a sessão assume
//    (só dentro da transação) o login de um Administrador que já exista: os dados obedecem às regras.
//  * Idempotente: cada área confere o seu marcador (placa ZDM..., CPF/CNPJ da faixa, origem "demo") e
//    pula o que já existe.
//  * `--ensaio`: faz tudo, mostra as contagens por área e desfaz (ROLLBACK). Não deixa nada.
//  * Recusa qualquer banco que não seja o local. Só mostra agregados: nenhum CPF, nome ou placa.
import { pathToFileURL } from "node:url";
import pg from "pg";

import { enderecoDoBancoLocal } from "./banco-local.ts";
import {
  codcencusDemo,
  PREFIXO_DA_PLACA_DEMO,
  PREFIXO_DO_RENAVAM_DEMO,
  abastecimentosDaDemo,
  cnpjFicticio,
  cpfFicticio,
  diaDaEscala,
  exigirBancoLocalParaDemo,
  nomeDeDemo,
  placaDemo,
  planoDasPessoas,
  somarDias,
} from "./demo-dados.ts";
import { ErroDoEixo, textoDoErro } from "../lib/log/erro.ts";

const N_CAVALOS = 30;
const N_IMPLEMENTOS = 20;
const N_PESSOAS = 60;

type Linha = Record<string, unknown>;

/** Hora de Brasília (sem horário de verão desde 2019) como texto ISO com fuso. */
function hora(dia: string, hhmm: string): string {
  return `${dia}T${hhmm}:00-03:00`;
}

export type ResumoDaDemo = Record<string, number>;

async function um<T = Linha>(c: pg.Client, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await c.query(sql, params);
  return rows[0] as T;
}

async function assumirAdministrador(c: pg.Client): Promise<void> {
  const adm = await um<{ auth_user_id: string } | undefined>(
    c,
    `select auth_user_id from nucleo.usuario where perfil = 'administrador' and ativo order by criado_em limit 1`,
  );
  if (!adm) {
    throw new ErroDoEixo(
      "Não há login de Administrador no banco local: crie com `pnpm dev:usuario` e rode de novo.",
    );
  }
  const claims = JSON.stringify({ sub: adm.auth_user_id, role: "authenticated" });
  await c.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [
    claims,
    adm.auth_user_id,
  ]);
}

async function pessoaDoCpf(c: pg.Client, cpf: string): Promise<string | null> {
  const r = await um<{ pessoa_id: string } | undefined>(
    c,
    `select pessoa_id from nucleo.pessoa_documento where documento = $1`,
    [cpf],
  );
  return r?.pessoa_id ?? null;
}

async function garantirPessoa(c: pg.Client, nome: string, cpf: string): Promise<string> {
  const existente = await pessoaDoCpf(c, cpf);
  if (existente) return existente;
  const r = await um<{ p: { id: string } }>(c, `select nucleo.cadastrar_pessoa($1, $2) as p`, [nome, cpf]);
  return r.p.id;
}

const PARCEIROS: { nome: string; tipos: string[]; documento: () => string }[] = [
  { nome: "Demo Transportes Alfa Ltda", tipos: ["acionista"], documento: () => cnpjFicticio(1) },
  { nome: "Demo Logística Beta Ltda", tipos: ["acionista"], documento: () => cnpjFicticio(2) },
  { nome: "Demo Cargas Gama Ltda", tipos: ["acionista", "locador"], documento: () => cnpjFicticio(3) },
  { nome: "Demo Agregado Delta", tipos: ["agregado"], documento: () => cpfFicticio(201) },
  { nome: "Demo Agregado Épsilon", tipos: ["agregado"], documento: () => cpfFicticio(202) },
  { nome: "Demo Locadora Zeta Ltda", tipos: ["locador"], documento: () => cnpjFicticio(6) },
  { nome: "Demo Locadora Eta Ltda", tipos: ["locador"], documento: () => cnpjFicticio(7) },
  { nome: "Demo Locações Teta", tipos: ["locador"], documento: () => cpfFicticio(203) },
];

async function carregarPessoasEEscala(c: pg.Client, hoje: string) {
  const operacoes = (
    await c.query<{ id: string }>(
      `select id from nucleo.operacao where excluido_em is null and tipo = 'operacao' and not parada order by nome, id`,
    )
  ).rows.map((r) => r.id);
  if (operacoes.length === 0) throw new ErroDoEixo("Não há operações no banco para vincular as pessoas.");
  const plano = planoDasPessoas(hoje, N_PESSOAS, operacoes.length);
  const dias: string[] = [];
  for (let d = plano[0]!.inicio; d <= hoje; d = somarDias(d, 1)) dias.push(d);
  let escalas = 0;
  for (const [i, p] of plano.entries()) {
    let pessoa = await pessoaDoCpf(c, p.cpf);
    if (!pessoa) {
      const r = await um<{ p: { id: string } }>(
        c,
        `select nucleo.cadastrar_pessoa($1, $2, null, $3::uuid, $4, $5::date) as p`,
        [p.nome, p.cpf, operacoes[p.operacaoIndice], p.funcao, p.inicio],
      );
      pessoa = r.p.id;
    }
    const jaTem = await um<{ n: string }>(
      c,
      `select count(*)::text as n from pessoas.marcacao_da_escala where pessoa_id = $1`,
      [pessoa],
    );
    if (Number(jaTem.n) > 0) continue;
    for (const dia of dias) {
      await c.query(`select nucleo.marcar_escala($1::uuid, $2::uuid, $3::date, $4)`, [
        pessoa,
        operacoes[p.operacaoIndice],
        dia,
        diaDaEscala(i, dia),
      ]);
      escalas++;
    }
  }
  return escalas;
}

async function carregarParceiros(c: pg.Client): Promise<void> {
  for (const p of PARCEIROS) {
    const documento = p.documento();
    if (await pessoaDoCpf(c, documento)) continue;
    await c.query(`select nucleo.cadastrar_parceiro($1, $2, $3::text[])`, [documento, p.nome, p.tipos]);
  }
}

async function parceiroDoDocumento(c: pg.Client, documento: string): Promise<string> {
  const r = await um<{ id: string } | undefined>(
    c,
    `select p.id from parceiros.parceiro p join nucleo.pessoa_documento d on d.pessoa_id = p.pessoa_id
      where d.documento = $1 and p.excluido_em is null`,
    [documento],
  );
  if (!r) throw new ErroDoEixo("Parceiro de demonstração não encontrado para a locação.");
  return r.id;
}

async function carregarFrota(c: pg.Client, hoje: string): Promise<string> {
  const jaTem = await um<{ n: string }>(
    c,
    `select count(*)::text as n from nucleo.placa_do_ativo where placa like $1 and excluido_em is null`,
    [`${PREFIXO_DA_PLACA_DEMO}%`],
  );
  if (Number(jaTem.n) > 0) return "já existia";

  const operacoes = (
    await c.query<{ id: string }>(
      `select id from nucleo.operacao where excluido_em is null and tipo = 'operacao' and not parada order by nome, id`,
    )
  ).rows.map((r) => r.id);
  const filiais = (
    await c.query<{ id: string }>(`select id from config.filial where excluido_em is null order by nome, id`)
  ).rows.map((r) => r.id);
  if (operacoes.length === 0 || filiais.length === 0) {
    throw new ErroDoEixo("Faltam operações ou filiais no banco para montar a frota de demonstração.");
  }
  const carroceria = await um<{ id: string } | undefined>(
    c,
    `select id from config.carroceria where excluido_em is null order by (nome = 'Graneleira') desc, nome limit 1`,
  );

  // Gestores fictícios (o papel de gestor não tem função própria: é a única gravação direta, como no dev).
  const gestores: string[] = [];
  for (let g = 0; g < 5; g++) {
    const id = await garantirPessoa(c, nomeDeDemo(g), cpfFicticio(g + 1));
    await c.query(
      `insert into nucleo.papel_da_pessoa (pessoa_id, papel) values ($1, 'gestor_de_frota') on conflict do nothing`,
      [id],
    );
    gestores.push(id);
  }
  const donos = gestores.slice(0, 4);
  const doLogin = await um<{ pessoa_id: string } | undefined>(
    c,
    `select u.pessoa_id from nucleo.usuario u
       join nucleo.papel_da_pessoa p on p.pessoa_id = u.pessoa_id and p.papel = 'gestor_de_frota'
      where u.perfil = 'gestor_de_frota' and u.ativo order by u.criado_em limit 1`,
  );
  const quemRecebe = doLogin?.pessoa_id ?? gestores[4]!;

  const t0 = hora(somarDias(hoje, -45), "08:00");
  const cadastrar = async (
    n: number,
    tipo: "cavalo" | "implemento",
    operacao: string,
    gestor: string,
  ): Promise<string> => {
    const cr = await um<{ id: string }>(c, `select nucleo.criar_cr($1::bigint, $2, $3) as id`, [
      codcencusDemo(n),
      `DEMO-${n}`,
      `Demo frota ${n}`,
    ]);
    const prefixo = PREFIXO_DO_RENAVAM_DEMO + String(n).padStart(5, "0");
    const renavam = await um<{ r: string }>(
      c,
      `select $1::text || d::text as r from generate_series(0, 9) d where nucleo.renavam_valido($1::text || d::text) limit 1`,
      [prefixo],
    );
    const a = await um<{ id: string }>(
      c,
      `select nucleo.cadastrar_ativo(
         p_tipo => $1::nucleo.tipo_de_ativo, p_renavam => $2, p_placa => $3, p_gestor_id => $4::uuid,
         p_cr_id => $5::uuid, p_operacao_id => $6::uuid, p_em => $7::timestamptz + ($8::int * interval '1 second'),
         p_funcao => $9::nucleo.funcao_do_implemento, p_carroceria_id => $10::uuid, p_eixos => $11::smallint
       ) as id`,
      [
        tipo,
        renavam.r,
        placaDemo(n),
        gestor,
        cr.id,
        operacao,
        t0,
        n,
        tipo === "implemento" ? "semirreboque" : null,
        tipo === "implemento" ? (carroceria?.id ?? null) : null,
        tipo === "implemento" ? 3 : null,
      ],
    );
    return a.id;
  };

  const cavalos: string[] = [];
  const implementos: string[] = [];
  for (let i = 1; i <= N_CAVALOS; i++) {
    cavalos.push(await cadastrar(i, "cavalo", operacoes[i % operacoes.length]!, donos[i % donos.length]!));
  }
  for (let k = 1; k <= N_IMPLEMENTOS; k++) {
    implementos.push(
      await cadastrar(N_CAVALOS + k, "implemento", operacoes[k % operacoes.length]!, donos[k % donos.length]!),
    );
  }
  // Conjuntos simples: o cavalo k engata o semirreboque k (k de 1 a 20).
  for (let k = 1; k <= N_IMPLEMENTOS; k++) {
    await c.query(`select nucleo.engatar($1::uuid, $2::uuid, 1::smallint, $3::timestamptz)`, [
      cavalos[k - 1],
      implementos[k - 1],
      hora(somarDias(hoje, -45), "09:00"),
    ]);
  }

  // Acompanhamento: situações lançadas ao longo dos últimos 30 dias (cavalos 11 a 20 em conjunto, 21 a 30 soltos).
  const lancar = async (ativo: string, sigla: string, dia: string) => {
    await c.query(`select nucleo.lancar_situacao_do_dia($1::uuid, $2, $3::date)`, [ativo, sigla, dia]);
  };
  const dias = [-29, -24, -19, -13, -8, -3];
  const conjunto = ["ETc", "CAr", "DEs", "ETv", "PÁT", "ETc"];
  const solo = ["ETv", "PÁT", "MAN", "ETv", "PÁT", "ETv"];
  const locado = ["ETv", "PÁT", "ALU", "ALU", "ALU", "ALU"];
  for (let i = 11; i <= N_CAVALOS; i++) {
    const roteiro = i <= 20 ? conjunto : i >= 26 ? locado : solo;
    for (const [j, d] of dias.entries()) {
      await lancar(cavalos[i - 1]!, roteiro[(j + (i % 3)) % roteiro.length]!, somarDias(hoje, d));
    }
  }

  // Operacional: os cavalos 1 a 10 vão para as filiais e andam pelo pátio em etapas diferentes.
  const versao = async (id: string) =>
    (await um<{ v: number }>(c, `select versao as v from nucleo.ativo where id = $1`, [id])).v;
  const patio = async (id: string, acao: string, quando: string, motivo: string | null = null) => {
    await c.query(`select nucleo.avancar_no_patio($1::uuid, $2, $3, $4::timestamptz)`, [id, acao, motivo, quando]);
  };
  const entrega = hora(somarDias(hoje, -4), "09:00");
  for (let i = 1; i <= 10; i++) {
    await c.query(
      `select nucleo.entregar_ao_operacional($1::uuid, $2::uuid, $3::timestamptz + ($4::int * interval '1 minute'), $5::integer)`,
      [cavalos[i - 1], filiais[i % filiais.length], entrega, i, await versao(cavalos[i - 1]!)],
    );
  }
  const destinos = ["Paranaguá/PR", "Sorriso/MT", "Santos/SP"];
  const ordem = async (id: string, op: string, destino: string, quando: string) => {
    await c.query(
      `select nucleo.criar_ordem_de_carregamento($1::uuid, $2::uuid, $3, $4::date, $5::timestamptz)`,
      [id, op, destino, hoje, quando],
    );
  };
  for (let i = 6; i <= 10; i++) {
    const id = cavalos[i - 1]!;
    if (i === 6) await patio(id, "aceitar", hora(somarDias(hoje, -1), "10:00"));
    if (i === 7) await patio(id, "aceitar", hora(somarDias(hoje, -1), "11:00"));
    if (i >= 8) {
      await patio(id, "aceitar", hora(somarDias(hoje, -3), "08:00"));
      await ordem(id, operacoes[i % operacoes.length]!, destinos[i % destinos.length]!, hora(somarDias(hoje, -3), "09:00"));
    }
    if (i >= 9) await patio(id, "concluir", hora(somarDias(hoje, -2), "16:00"));
    if (i === 10) await patio(id, "liberar", hora(somarDias(hoje, -1), "07:00"));
  }
  // A fila do Totem: os cavalos 1 a 6 chegaram hoje, em ordem de chegada.
  for (let i = 1; i <= 6; i++) {
    await c.query(`select nucleo.registrar_chegada($1, now() - ($2::int * interval '12 minutes'))`, [
      placaDemo(i),
      7 - i,
    ]);
  }

  // Cinco pedidos de transferência abertos, para o "Para receber".
  for (let i = 21; i <= 25; i++) {
    await c.query(
      `select nucleo.disponibilizar_placa($1::uuid, $2::uuid, $3, $4::text[], $5::integer, now() - ($6::int * interval '1 hour'))`,
      [
        cavalos[i - 1],
        quemRecebe,
        "Demo: rebalanceamento da carteira",
        i % 2 === 0 ? ["Conferir o estepe"] : [],
        await versao(cavalos[i - 1]!),
        26 - i,
      ],
    );
  }

  // Locação: cinco cavalos locados a parceiros locadores da demonstração.
  const locadores = [cnpjFicticio(3), cnpjFicticio(6), cnpjFicticio(7), cpfFicticio(203), cnpjFicticio(6)];
  for (let i = 26; i <= 30; i++) {
    await c.query(
      `select nucleo.cadastrar_locacao($1::uuid, $2, $3::date, $4::numeric)`,
      [await parceiroDoDocumento(c, locadores[i - 26]!), placaDemo(i), somarDias(hoje, -50), String(7800 + (i - 26) * 450)],
    );
  }
  return "carregada";
}

/** O abastecimento fica no staging (que entra no backup); idempotente por origem_id. */
export async function carregarAbastecimento(c: pg.Client, hoje: string): Promise<number> {
  const placas = Array.from({ length: 10 }, (_, i) => placaDemo(i + 1));
  let n = 0;
  for (const a of abastecimentosDaDemo(hoje, placas)) {
    const r = await c.query(
      `insert into staging.abastecimento (origem_id, placa, data, km_inicial, km_final, litros, valor_total, combustivel, origem)
       values ($1, $2, $3::date, $4, $5, $6, $7, $8, $9) on conflict (origem_id) do nothing`,
      [a.origemId, a.placa, a.data, a.kmInicial, a.kmFinal, a.litros, a.valorTotal, a.combustivel, a.origem],
    );
    n += r.rowCount ?? 0;
  }
  return n;
}

export async function resumoDaDemo(c: pg.Client): Promise<ResumoDaDemo> {
  const { rows } = await c.query<{ item: string; n: string }>(
    `with demo as (select ativo_id from nucleo.placa_do_ativo where placa like $1 and excluido_em is null)
     select 'frota: placas da demo' item, count(*)::text n from demo
     union all select 'frota: conjuntos engatados', count(*)::text from nucleo.composicao where fim is null and excluido_em is null and cavalo_id in (select ativo_id from demo)
     union all select 'frota: CRs da demo', count(*)::text from nucleo.cr where codigo like 'DEMO-%'
     union all select 'acompanhamento: eventos de situação', count(*)::text from nucleo.evento_de_status where ativo_id in (select ativo_id from demo)
     union all select 'operacional: placas com o Operacional', count(*)::text from nucleo.custodia where com_quem = 'operacional' and fim is null and excluido_em is null and ativo_id in (select ativo_id from demo)
     union all select 'operacional: entregas (histórico)', count(*)::text from nucleo.custodia where com_quem = 'operacional' and excluido_em is null and ativo_id in (select ativo_id from demo)
     union all select 'operacional: chegadas na fila do Totem', count(*)::text from operacional.chegada where saiu_em is null and ativo_id in (select ativo_id from demo)
     union all select 'operacional: ordens de carregamento', count(*)::text from operacional.ordem_de_carregamento where ativo_id in (select ativo_id from demo)
     union all select 'operacional: ordens em viagem', count(*)::text from operacional.ordem_de_carregamento where situacao = 'em_viagem' and ativo_id in (select ativo_id from demo)
     union all select 'transferência: pedidos abertos', count(*)::text from nucleo.transferencia where situacao in ('pendente', 'em_conferencia') and excluido_em is null and ativo_id in (select ativo_id from demo)
     union all select 'pessoas: pessoas Demo', count(*)::text from nucleo.pessoa where nome like 'Demo %' and excluido_em is null
     union all select 'pessoas: vínculos', count(*)::text from pessoas.vinculo v join nucleo.pessoa p on p.id = v.pessoa_id where p.nome like 'Demo %' and v.excluido_em is null
     union all select 'pessoas: marcações da escala', count(*)::text from pessoas.marcacao_da_escala m join nucleo.pessoa p on p.id = m.pessoa_id where p.nome like 'Demo %'
     union all select 'parceiros: parceiros Demo', count(*)::text from parceiros.parceiro pa join nucleo.pessoa p on p.id = pa.pessoa_id where p.nome like 'Demo %' and pa.excluido_em is null
     union all select 'parceiros: locações', count(*)::text from parceiros.locacao where ativo_id in (select ativo_id from demo) and excluido_em is null
     union all select 'abastecimento: abastecimentos', count(*)::text from staging.abastecimento where origem = 'demo'
     union all select 'fila: exceções abertas da demo', count(*)::text from nucleo.fila_de_excecoes where resolvida_em is null and (ativo_id in (select ativo_id from demo) or cr_id in (select id from nucleo.cr where codigo like 'DEMO-%'))
     union all select 'abastecimento: placas', count(distinct placa)::text from staging.abastecimento where origem = 'demo'`,
    [`${PREFIXO_DA_PLACA_DEMO}%`],
  );
  return Object.fromEntries(rows.map((r) => [r.item, Number(r.n)]));
}

export async function carregarDemo(c: pg.Client): Promise<{ areas: Record<string, string>; abastecimento: number }> {
  const hoje = (await um<{ d: string }>(c, `select nucleo.hoje_em_sao_paulo()::text as d`)).d;
  await assumirAdministrador(c);
  const areas: Record<string, string> = {};
  await carregarParceiros(c);
  areas["parceiros"] = "ok";
  areas["pessoas e escala"] = `${await carregarPessoasEEscala(c, hoje)} marcações novas`;
  areas["frota, operacional, acompanhamento, pedidos e locação"] = await carregarFrota(c, hoje);
  const abastecimento = await carregarAbastecimento(c, hoje);
  await c.query("set constraints all immediate");
  return { areas, abastecimento };
}

async function principal() {
  const ensaio = process.argv.slice(2).includes("--ensaio");
  const endereco = enderecoDoBancoLocal();
  exigirBancoLocalParaDemo(endereco);
  const c = new pg.Client({ connectionString: endereco });
  await c.connect();
  try {
    const inicio = performance.now();
    await c.query("begin");
    const feito = await carregarDemo(c);
    const resumo = await resumoDaDemo(c);
    if (ensaio) {
      // Idempotência: a segunda passada não pode mudar nenhuma contagem.
      await carregarDemo(c);
      const segunda = await resumoDaDemo(c);
      console.log(
        JSON.stringify(segunda) === JSON.stringify(resumo)
          ? "Segunda passada: nada mudou (idempotente)."
          : "ATENÇÃO: a segunda passada mudou contagens: " + JSON.stringify(segunda),
      );
      await c.query("rollback");
      console.log("ENSAIO: tudo foi feito e desfeito (rollback); o banco não mudou.");
    } else {
      await c.query("commit");
      console.log("Dados de demonstração gravados no banco local.");
    }
    for (const [area, estado] of Object.entries(feito.areas)) console.log(`  ${area}: ${estado}`);
    console.log(`  abastecimento (staging): ${feito.abastecimento} linhas novas`);
    for (const [item, n] of Object.entries(resumo)) console.log(`  ${item}: ${n}`);
    console.log(`Em ${Math.round((performance.now() - inicio) / 1000)} s.`);
  } catch (erro) {
    await c.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    await c.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((erro: unknown) => {
    console.error(textoDoErro(erro));
    process.exit(1);
  });
}
