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
//  * Cenários de observação (12/11/2026): pedidos em atraso e em conferência, movimento dos últimos dias,
//    vínculos com história, uma exceção de cada tipo possível, a "Operação Demo" (sem lançamentos de
//    receita nem custo, que somariam aos totais reais) e a faixa "banco em demonstração" (config.parametro).
//  * `--ensaio`: faz tudo, mostra as contagens por área e desfaz (ROLLBACK). Não deixa nada.
//  * Recusa qualquer banco que não seja o local. Só mostra agregados: nenhum CPF, nome ou placa.
import { pathToFileURL } from "node:url";
import pg from "pg";

import { enderecoDoBancoLocal } from "./banco-local.ts";
import {
  CHAVE_DA_FAIXA_DEMO,
  CIDADES_DA_DEMO,
  posicaoDeOntem,
  NUMEROS_DOS_CENARIOS,
  codcencusDemo,
  planoDosPedidos,
  planoDosVinculos,
  roteiroDoMovimento,
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
  await c.query(
    `select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`,
    [claims, adm.auth_user_id],
  );
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
  const r = await um<{ p: { id: string } }>(c, `select nucleo.cadastrar_pessoa($1, $2) as p`, [
    nome,
    cpf,
  ]);
  return r.p.id;
}

const PARCEIROS: { nome: string; tipos: string[]; documento: () => string }[] = [
  { nome: "Demo Transportes Alfa Ltda", tipos: ["acionista"], documento: () => cnpjFicticio(1) },
  { nome: "Demo Logística Beta Ltda", tipos: ["acionista"], documento: () => cnpjFicticio(2) },
  {
    nome: "Demo Cargas Gama Ltda",
    tipos: ["acionista", "locador"],
    documento: () => cnpjFicticio(3),
  },
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
  if (operacoes.length === 0)
    throw new ErroDoEixo("Não há operações no banco para vincular as pessoas.");
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
    await c.query(`select nucleo.cadastrar_parceiro($1, $2, $3::text[])`, [
      documento,
      p.nome,
      p.tipos,
    ]);
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
    await c.query<{ id: string }>(
      `select id from config.filial where excluido_em is null order by nome, id`,
    )
  ).rows.map((r) => r.id);
  if (operacoes.length === 0 || filiais.length === 0) {
    throw new ErroDoEixo(
      "Faltam operações ou filiais no banco para montar a frota de demonstração.",
    );
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
    cavalos.push(
      await cadastrar(i, "cavalo", operacoes[i % operacoes.length]!, donos[i % donos.length]!),
    );
  }
  for (let k = 1; k <= N_IMPLEMENTOS; k++) {
    implementos.push(
      await cadastrar(
        N_CAVALOS + k,
        "implemento",
        operacoes[k % operacoes.length]!,
        donos[k % donos.length]!,
      ),
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
    await c.query(`select nucleo.lancar_situacao_do_dia($1::uuid, $2, $3::date)`, [
      ativo,
      sigla,
      dia,
    ]);
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
    await c.query(`select nucleo.avancar_no_patio($1::uuid, $2, $3, $4::timestamptz)`, [
      id,
      acao,
      motivo,
      quando,
    ]);
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
      await ordem(
        id,
        operacoes[i % operacoes.length]!,
        destinos[i % destinos.length]!,
        hora(somarDias(hoje, -3), "09:00"),
      );
    }
    if (i >= 9) await patio(id, "concluir", hora(somarDias(hoje, -2), "16:00"));
    if (i === 10) await patio(id, "liberar", hora(somarDias(hoje, -1), "07:00"));
  }
  // A fila do Totem: os cavalos 1 a 6 chegaram hoje, em ordem de chegada.
  for (let i = 1; i <= 6; i++) {
    await c.query(
      `select nucleo.registrar_chegada($1, now() - ($2::int * interval '12 minutes'))`,
      [placaDemo(i), 7 - i],
    );
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
  const locadores = [
    cnpjFicticio(3),
    cnpjFicticio(6),
    cnpjFicticio(7),
    cpfFicticio(203),
    cnpjFicticio(6),
  ];
  for (let i = 26; i <= 30; i++) {
    await c.query(`select nucleo.cadastrar_locacao($1::uuid, $2, $3::date, $4::numeric)`, [
      await parceiroDoDocumento(c, locadores[i - 26]!),
      placaDemo(i),
      somarDias(hoje, -50),
      String(7800 + (i - 26) * 450),
    ]);
  }
  return "carregada";
}

// ---------------------------------------------------------------------------------------------
// Cenários de observação (12/11/2026). Tudo pelas funções atômicas e pelos caminhos que o app usa
// (tabelas com RLS, como o Administrador); nada é apagado, e só placas ZDM, CRs DEMO-n e a
// "Operação Demo" são tocados. Cada cenário confere o seu marcador e pula o que já existe.
// ---------------------------------------------------------------------------------------------

/** Roda como o `authenticated` (o papel do app) dentro da transação: a RLS e os gatilhos valem. */
async function comoUsuario<T>(c: pg.Client, fazer: () => Promise<T>): Promise<T> {
  await c.query("set local role authenticated");
  try {
    return await fazer();
  } finally {
    await c.query("reset role").catch(() => undefined);
  }
}

/** Roda sem usuário (como a carga e os workers), e depois volta a assumir o Administrador. */
async function comoSistema<T>(c: pg.Client, fazer: () => Promise<T>): Promise<T> {
  await c.query(
    `select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)`,
  );
  try {
    return await fazer();
  } finally {
    await assumirAdministrador(c);
  }
}

const NOME_DA_OPERACAO_DEMO = "Operação Demo";

async function operacoesDaFrota(c: pg.Client): Promise<string[]> {
  return (
    await c.query<{ id: string }>(
      `select id from nucleo.operacao where excluido_em is null and tipo = 'operacao' and not parada and nome <> $1 order by nome, id`,
      [NOME_DA_OPERACAO_DEMO],
    )
  ).rows.map((r) => r.id);
}

async function garantirGestoresDemo(c: pg.Client): Promise<string[]> {
  const gestores: string[] = [];
  for (let g = 0; g < 5; g++) {
    const id = await garantirPessoa(c, nomeDeDemo(g), cpfFicticio(g + 1));
    await c.query(
      `insert into nucleo.papel_da_pessoa (pessoa_id, papel) values ($1, 'gestor_de_frota') on conflict do nothing`,
      [id],
    );
    gestores.push(id);
  }
  return gestores;
}

async function ativoDaPlacaDemo(c: pg.Client, n: number): Promise<string | null> {
  const r = await um<{ ativo_id: string } | undefined>(
    c,
    `select ativo_id from nucleo.placa_do_ativo where placa = $1 and excluido_em is null`,
    [placaDemo(n)],
  );
  return r?.ativo_id ?? null;
}

async function exigirAtivoDaPlacaDemo(c: pg.Client, n: number): Promise<string> {
  const id = await ativoDaPlacaDemo(c, n);
  if (!id) throw new ErroDoEixo(`A placa ${n} da demonstração não existe: carregue a frota antes.`);
  return id;
}

/** O CR de frota fictício número n (criado pelo "+" do cadastro, criar_cr), ou o que já existe. */
async function crDeFrotaDemo(c: pg.Client, n: number): Promise<string> {
  const existente = await um<{ id: string } | undefined>(
    c,
    `select id from nucleo.cr where codigo = $1`,
    [`DEMO-${n}`],
  );
  if (existente) return existente.id;
  return (
    await um<{ id: string }>(c, `select nucleo.criar_cr($1::bigint, $2, $3) as id`, [
      codcencusDemo(n),
      `DEMO-${n}`,
      `Demo frota ${n}`,
    ])
  ).id;
}

/** Cria CR pelo caminho de Cadastros (INSERT com RLS), com os sinais dados; devolve o id. */
async function crDeCadastrosDemo(
  c: pg.Client,
  n: number,
  nome: string,
  sinais: {
    participaDaFrota: boolean;
    veiculoObrigatorio?: boolean;
    unidade?: string;
    adFrota?: string;
  },
): Promise<string> {
  const existente = await um<{ id: string } | undefined>(
    c,
    `select id from nucleo.cr where codigo = $1`,
    [`DEMO-${n}`],
  );
  if (existente) return existente.id;
  return comoUsuario(c, async () => {
    const r = await um<{ id: string }>(
      c,
      `insert into nucleo.cr (codcencus, codigo, nome, participa_da_frota, veiculo_obrigatorio, unidade_gerencial, ad_frota)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [
        codcencusDemo(n),
        `DEMO-${n}`,
        nome,
        sinais.participaDaFrota,
        sinais.veiculoObrigatorio ?? null,
        sinais.unidade ?? null,
        sinais.adFrota ?? null,
      ],
    );
    return r.id;
  });
}

async function renavamDemo(c: pg.Client, n: number): Promise<string> {
  const prefixo = PREFIXO_DO_RENAVAM_DEMO + String(n).padStart(5, "0");
  return (
    await um<{ r: string }>(
      c,
      `select $1::text || d::text as r from generate_series(0, 9) d where nucleo.renavam_valido($1::text || d::text) limit 1`,
      [prefixo],
    )
  ).r;
}

/** Cadastra o cavalo da demonstração número n (cadastrar_ativo) com o CR e a operação dados. */
async function cadastrarCavaloDemo(
  c: pg.Client,
  n: number,
  crId: string,
  operacaoId: string,
  gestorId: string,
  em: string,
): Promise<string> {
  const a = await um<{ id: string }>(
    c,
    `select nucleo.cadastrar_ativo(
       p_tipo => 'cavalo'::nucleo.tipo_de_ativo, p_renavam => $1, p_placa => $2, p_gestor_id => $3::uuid,
       p_cr_id => $4::uuid, p_operacao_id => $5::uuid, p_em => $6::timestamptz
     ) as id`,
    [await renavamDemo(c, n), placaDemo(n), gestorId, crId, operacaoId, em],
  );
  return a.id;
}

/** O cavalo com cadastro pendente (sem RENAVAM), gravado como a carga da v1 grava: só a placa ZDM do cenário. */
async function cadastrarCavaloPendenteDaCarga(
  c: pg.Client,
  n: number,
  crId: string,
  operacaoId: string,
  gestorId: string,
  em: string,
): Promise<void> {
  await comoSistema(c, async () => {
    const a = await um<{ id: string }>(
      c,
      `insert into nucleo.ativo (tipo, cadastro_pendente) values ('cavalo', true) returning id`,
    );
    await c.query(
      `insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, inicio_origem) values ($1, $2, $3::timestamptz, 'informada')`,
      [a.id, placaDemo(n), em],
    );
    await c.query(
      `insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem) values ($1, 'propria', $2::timestamptz, 'informada')`,
      [a.id, em],
    );
    await c.query(
      `insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem) values ($1, $2, $3::timestamptz, 'informada')`,
      [a.id, gestorId, em],
    );
    await c.query(`select nucleo.registrar_evento($1::uuid, 'PÁT', $2::timestamptz)`, [a.id, em]);
    await c.query(
      `insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem) values ($1, $2, $3::timestamptz, 'informada')`,
      [a.id, crId, em],
    );
    await c.query(
      `insert into nucleo.placa_na_operacao (ativo_id, operacao_id, inicio, inicio_origem) values ($1, $2, $3::timestamptz, 'informada')`,
      [a.id, operacaoId, em],
    );
  });
}

/** Encerra o CR vigente e a operação vigente da placa em `quando` e abre os novos (história de vínculos). */
async function trocarVinculos(
  c: pg.Client,
  ativoId: string,
  novoCrId: string,
  novaOperacaoId: string,
  quando: string,
): Promise<void> {
  await comoUsuario(c, async () => {
    await c.query(
      `update nucleo.cr_do_ativo set fim = $2::timestamptz, fim_origem = 'informada' where ativo_id = $1 and fim is null and excluido_em is null`,
      [ativoId, quando],
    );
    await c.query(
      `insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem) values ($1, $2, $3::timestamptz, 'informada')`,
      [ativoId, novoCrId, quando],
    );
    await c.query(
      `update nucleo.placa_na_operacao set fim = $2::timestamptz, fim_origem = 'informada' where ativo_id = $1 and fim is null and excluido_em is null`,
      [ativoId, quando],
    );
    await c.query(
      `insert into nucleo.placa_na_operacao (ativo_id, operacao_id, inicio, inicio_origem) values ($1, $2, $3::timestamptz, 'informada')`,
      [ativoId, novaOperacaoId, quando],
    );
  });
}

/** Tarefas: pedidos de transferência (pendentes, atrasados e em conferência com pendências abertas). */
export async function carregarPedidosEmAtraso(c: pg.Client, hoje: string): Promise<number> {
  const gestores = await garantirGestoresDemo(c);
  let novos = 0;
  for (const p of planoDosPedidos()) {
    const ativo = await exigirAtivoDaPlacaDemo(c, p.cavalo);
    const jaTem = await um<{ n: string }>(
      c,
      `select count(*)::text as n from nucleo.transferencia where ativo_id = $1 and excluido_em is null`,
      [ativo],
    );
    if (Number(jaTem.n) > 0) continue;
    const dono = await um<{ gestor_id: string }>(
      c,
      `select gestor_id from nucleo.gestor_da_carteira where ativo_id = $1 and fim is null and excluido_em is null`,
      [ativo],
    );
    const destino = gestores[(gestores.indexOf(dono.gestor_id) + 1) % gestores.length]!;
    const versao = (
      await um<{ v: number }>(c, `select versao as v from nucleo.ativo where id = $1`, [ativo])
    ).v;
    const aberto = hora(somarDias(hoje, -p.diasAbertos), "09:00");
    const pedido = await um<{ id: string }>(
      c,
      `select nucleo.disponibilizar_placa($1::uuid, $2::uuid, $3, $4::text[], $5::integer, $6::timestamptz) as id`,
      [ativo, destino, "Demo: pedido para a observação de atrasos", p.pendencias, versao, aberto],
    );
    if (p.situacao === "em_conferencia") {
      // Só o gestor de destino recebe pelo app, e os gestores Demo não têm login: a recepção entra como a
      // carga (sem usuário), o caminho do sistema que a própria função prevê, e volta ao Administrador.
      await comoSistema(c, async () => {
        await c.query(`select nucleo.receber_transferencia($1::uuid, $2::timestamptz)`, [
          pedido.id,
          hora(somarDias(hoje, -p.diasAbertos + 1), "10:00"),
        ]);
      });
    }
    novos++;
  }
  return novos;
}

/** Movimento: situações dos últimos dias, inclusive hoje, com siglas diferentes. */
export async function carregarMovimento(c: pg.Client, hoje: string): Promise<number> {
  const primeiro = await exigirAtivoDaPlacaDemo(c, 11);
  const jaTem = await um<{ n: string }>(
    c,
    `select count(*)::text as n from nucleo.evento_de_status
      where ativo_id = $1 and origem = 'manual' and excluido_em is null and em >= nucleo.instante_do_dia($2::date)`,
    [primeiro, somarDias(hoje, -2)],
  );
  if (Number(jaTem.n) > 0) return 0;
  let n = 0;
  for (let cavalo = 11; cavalo <= 25; cavalo++) {
    const ativo = await exigirAtivoDaPlacaDemo(c, cavalo);
    for (const l of roteiroDoMovimento(cavalo)) {
      await c.query(`select nucleo.lancar_situacao_do_dia($1::uuid, $2, $3::date)`, [
        ativo,
        l.sigla,
        somarDias(hoje, -l.diasAtras),
      ]);
      n++;
    }
  }
  return n;
}

/** Vínculos com história: 6 placas com CR e operação trocados (duas há pouco) e os casos de borda. */
export async function carregarVinculosComHistoria(c: pg.Client, hoje: string): Promise<number> {
  const gestores = await garantirGestoresDemo(c);
  const operacoes = await operacoesDaFrota(c);
  if (operacoes.length < 2) throw new ErroDoEixo("Faltam operações para a história dos vínculos.");
  let placas = 0;
  for (const [i, v] of planoDosVinculos().entries()) {
    if (await ativoDaPlacaDemo(c, v.placa)) continue;
    const inicio = hora(somarDias(hoje, -v.inicioHaDias), "08:00");
    const antigo = await crDeFrotaDemo(c, v.crAntigo);
    const ativo = await cadastrarCavaloDemo(
      c,
      v.placa,
      antigo,
      operacoes[v.operacaoAntiga % operacoes.length]!,
      gestores[i % 4]!,
      inicio,
    );
    await trocarVinculos(
      c,
      ativo,
      await crDeFrotaDemo(c, v.crAtual),
      operacoes[v.operacaoAtual % operacoes.length]!,
      hora(somarDias(hoje, -v.trocaHaDias), "12:00"),
    );
    placas++;
  }

  // Uma placa com CR de frota e CR de acionista ao mesmo tempo (a exceção de 06/11/2026: sem alerta).
  const fa = NUMEROS_DOS_CENARIOS.placaComFrotaEAcionista;
  if (!(await ativoDaPlacaDemo(c, fa.placa))) {
    const inicio = hora(somarDias(hoje, -60), "08:00");
    const ativo = await cadastrarCavaloDemo(
      c,
      fa.placa,
      await crDeFrotaDemo(c, fa.crFrota),
      operacoes[0]!,
      gestores[0]!,
      inicio,
    );
    const acionista = await crDeCadastrosDemo(c, fa.crAcionista, "Demo acionista", {
      participaDaFrota: false,
      unidade: "acionista",
    });
    await comoUsuario(c, async () => {
      await c.query(
        `insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem) values ($1, $2, $3::timestamptz, 'informada')`,
        [ativo, acionista, inicio],
      );
    });
    placas++;
  }
  return placas;
}

/** Fila de exceções: uma de cada tipo que dá para abrir, só com placas ZDM, CRs DEMO-n e lançamento DEMO-. */
export async function carregarExcecoes(c: pg.Client, hoje: string): Promise<number> {
  const gestores = await garantirGestoresDemo(c);
  const operacoes = await operacoesDaFrota(c);
  const antes = (
    await um<{ n: string }>(c, `select count(*)::text as n from nucleo.fila_de_excecoes`)
  ).n;
  const n = NUMEROS_DOS_CENARIOS;

  // Dois CRs do mesmo tipo ao mesmo tempo (abre sozinha pelo gatilho do vínculo).
  if (!(await ativoDaPlacaDemo(c, n.placaComDoisCr.placa))) {
    const inicio = hora(somarDias(hoje, -45), "08:00");
    const ativo = await cadastrarCavaloDemo(
      c,
      n.placaComDoisCr.placa,
      await crDeFrotaDemo(c, n.placaComDoisCr.crAtual),
      operacoes[1 % operacoes.length]!,
      gestores[1]!,
      inicio,
    );
    const segundo = await crDeFrotaDemo(c, n.placaComDoisCr.crDuplicado);
    await comoUsuario(c, async () => {
      await c.query(
        `insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem) values ($1, $2, $3::timestamptz, 'informada')`,
        [ativo, segundo, hora(somarDias(hoje, -30), "08:00")],
      );
    });
  }

  // Cadastro pendente: o cavalo sem RENAVAM, do jeito da carga inicial (a única forma: o RENAVAM é chave
  // e o cadastrar_ativo não grava a marca). Entra como o sistema, só esta placa ZDM; o gatilho abre a exceção.
  if (!(await ativoDaPlacaDemo(c, n.placaDeCadastroIncompleto.placa))) {
    await cadastrarCavaloPendenteDaCarga(
      c,
      n.placaDeCadastroIncompleto.placa,
      await crDeFrotaDemo(c, n.placaDeCadastroIncompleto.cr),
      operacoes[2 % operacoes.length]!,
      gestores[2]!,
      hora(somarDias(hoje, -30), "08:00"),
    );
  }

  // Placa sem CR: o CR da placa terminou e não veio outro (alerta sem_cr).
  if (!(await ativoDaPlacaDemo(c, n.placaSemCr.placa))) {
    const ativo = await cadastrarCavaloDemo(
      c,
      n.placaSemCr.placa,
      await crDeFrotaDemo(c, n.placaSemCr.cr),
      operacoes[3 % operacoes.length]!,
      gestores[3]!,
      hora(somarDias(hoje, -50), "08:00"),
    );
    await comoUsuario(c, async () => {
      await c.query(
        `update nucleo.cr_do_ativo set fim = $2::timestamptz, fim_origem = 'informada' where ativo_id = $1 and fim is null and excluido_em is null`,
        [ativo, hora(somarDias(hoje, -10), "12:00")],
      );
    });
  }

  // CR de serviço sem operação (alerta cr_sem_operacao) e CR de frota que diverge da unidade (fila).
  await crDeCadastrosDemo(c, n.crDeServicoSemOperacao, "Demo serviço sem operação", {
    participaDaFrota: false,
  });
  await crDeCadastrosDemo(c, n.crQueDivergeDaUnidade, "Demo frota que diverge", {
    participaDaFrota: true,
    veiculoObrigatorio: true,
    unidade: "frota",
    adFrota: "N",
  });

  // Data fora de faixa: um lançamento DEMO- no staging, fora da faixa (nunca entra em total algum).
  // A função que abre a exceção varre todo o staging: só roda se não houver lançamento REAL por registrar.
  const jaTemData = await um<{ n: string }>(
    c,
    `select count(*)::text as n from nucleo.fila_de_excecoes where lancamento_origem_id = 'DEMO-DATA-FORA-DE-FAIXA'`,
  );
  if (Number(jaTemData.n) === 0) {
    const reaisPorRegistrar = await um<{ n: string }>(
      c,
      `select count(*)::text as n from staging.despesa d
        where d.invalidado_em is null and d.provisao is distinct from 'PROVISAO'
          and d.dt_competencia is not null and not nucleo.data_na_faixa(d.dt_competencia)
          and d.origem_id <> 'DEMO-DATA-FORA-DE-FAIXA'
          and not exists (select 1 from nucleo.fila_de_excecoes f
                           where f.lancamento_origem_id = d.origem_id and f.assunto = 'data_fora_de_faixa')`,
    );
    if (Number(reaisPorRegistrar.n) === 0) {
      await c.query(
        `insert into staging.despesa (origem_id, nufin, dt_competencia, provisao)
         values ('DEMO-DATA-FORA-DE-FAIXA', 'DEMO-1', date '2019-12-31', null) on conflict (origem_id) do nothing`,
      );
      await c.query(`select nucleo.registrar_excecoes_de_data()`);
    }
  }
  const depois = (
    await um<{ n: string }>(c, `select count(*)::text as n from nucleo.fila_de_excecoes`)
  ).n;
  return Number(depois) - Number(antes);
}

/** Operações: a "Operação Demo" com 8 placas e CRs de frota e de serviço fictícios (sem lançamentos). */
export async function carregarOperacaoDemo(c: pg.Client, hoje: string): Promise<number> {
  const gestores = await garantirGestoresDemo(c);
  const n = NUMEROS_DOS_CENARIOS.operacaoDemo;
  let operacao = (
    await c.query<{ id: string }>(
      `select id from nucleo.operacao where nome = $1 and excluido_em is null`,
      [NOME_DA_OPERACAO_DEMO],
    )
  ).rows[0]?.id;
  if (!operacao) {
    operacao = await comoUsuario(c, async () => {
      const r = await um<{ id: string }>(
        c,
        `insert into nucleo.operacao (nome, tipo, base_cidade, base_uf) values ($1, 'operacao', 'São Luís', 'MA') returning id`,
        [NOME_DA_OPERACAO_DEMO],
      );
      return r.id;
    });
  }
  let novas = 0;
  for (let i = 0; i < n.placas; i++) {
    const numero = n.placaInicial + i;
    if (await ativoDaPlacaDemo(c, numero)) continue;
    await cadastrarCavaloDemo(
      c,
      numero,
      await crDeFrotaDemo(c, numero),
      operacao,
      gestores[i % 4]!,
      hora(somarDias(hoje, -60), "08:00"),
    );
    novas++;
  }
  for (const [k, crN] of n.crsDeServico.entries()) {
    const cr = await crDeCadastrosDemo(c, crN, `Demo serviço ${k + 1}`, {
      participaDaFrota: false,
    });
    const ligado = await um<{ n: string }>(
      c,
      `select count(*)::text as n from nucleo.cr_de_servico_na_operacao where cr_id = $1 and excluido_em is null`,
      [cr],
    );
    if (Number(ligado.n) > 0) continue;
    await comoUsuario(c, async () => {
      await c.query(
        `insert into nucleo.cr_de_servico_na_operacao (cr_id, operacao_id, inicio, inicio_origem) values ($1, $2, $3::timestamptz, 'informada')`,
        [cr, operacao, hora(somarDias(hoje, -60), "08:00")],
      );
    });
  }
  return novas;
}

/** Liga a faixa "banco em demonstração" (a restauração do backup real a remove, pois o real não a tem). */
export async function ligarFaixaDaDemo(c: pg.Client): Promise<void> {
  await comoUsuario(c, async () => {
    await c.query(
      `insert into config.parametro (chave, valor, descricao) values ($1, 'sim', $2) on conflict (chave) do nothing`,
      [
        CHAVE_DA_FAIXA_DEMO,
        "Liga a faixa fixa que avisa que o banco tem dados fictícios de demonstração misturados com os reais. Só a carga de demonstração a grava; a restauração do backup real a remove.",
      ],
    );
  });
}

/** O abastecimento fica no staging (que entra no backup); idempotente por origem_id. */
export async function carregarAbastecimento(c: pg.Client, hoje: string): Promise<number> {
  const placas = Array.from({ length: 10 }, (_, i) => placaDemo(i + 1));
  let n = 0;
  for (const a of abastecimentosDaDemo(hoje, placas)) {
    const r = await c.query(
      `insert into staging.abastecimento (origem_id, placa, data, km_inicial, km_final, litros, valor_total, combustivel, origem)
       values ($1, $2, $3::date, $4, $5, $6, $7, $8, $9) on conflict (origem_id) do nothing`,
      [
        a.origemId,
        a.placa,
        a.data,
        a.kmInicial,
        a.kmFinal,
        a.litros,
        a.valorTotal,
        a.combustivel,
        a.origem,
      ],
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
     union all select 'abastecimento: placas', count(distinct placa)::text from staging.abastecimento where origem = 'demo'
     union all select 'tarefas: pedidos em conferência', count(*)::text from nucleo.transferencia where situacao = 'em_conferencia' and excluido_em is null and ativo_id in (select ativo_id from demo)
     union all select 'tarefas: pedidos atrasados (mais de 5 dias abertos)', count(*)::text from nucleo.transferencia where situacao in ('pendente', 'em_conferencia') and excluido_em is null and criado_em < now() - interval '5 days' and ativo_id in (select ativo_id from demo)
     union all select 'tarefas: pendências abertas nos pedidos', count(*)::text from nucleo.transferencia_pendencia p join nucleo.transferencia t on t.id = p.transferencia_id where p.resposta is null and p.excluido_em is null and t.excluido_em is null and t.situacao in ('pendente', 'em_conferencia') and t.ativo_id in (select ativo_id from demo)
     union all select 'tarefas: gestores Demo com a carteira do mês a confirmar', count(distinct g.gestor_id)::text from nucleo.gestor_da_carteira g join nucleo.pessoa pe on pe.id = g.gestor_id where pe.nome like 'Demo %' and g.fim is null and g.excluido_em is null and g.ativo_id in (select ativo_id from demo) and not exists (select 1 from nucleo.confirmacao_da_carteira cc where cc.gestor_id = g.gestor_id and cc.ativo_id = g.ativo_id and cc.mes = date_trunc('month', nucleo.hoje_em_sao_paulo())::date)
     union all select 'vínculos: placas com CR encerrado e CR vigente', count(*)::text from (select v.ativo_id from nucleo.cr_do_ativo v where v.excluido_em is null and v.ativo_id in (select ativo_id from demo) group by v.ativo_id having count(*) filter (where v.fim is not null) > 0 and count(*) filter (where v.fim is null) > 0) x
     union all select 'vínculos: trocas de CR nos últimos 14 dias', count(*)::text from nucleo.cr_do_ativo v where v.excluido_em is null and v.fim is not null and v.fim >= now() - interval '14 days' and v.ativo_id in (select ativo_id from demo)
     union all select 'vínculos: placas com mais de um CR vigente', count(*)::text from (select v.ativo_id from nucleo.cr_do_ativo v where v.excluido_em is null and v.fim is null and v.ativo_id in (select ativo_id from demo) group by v.ativo_id having count(*) > 1) x
     union all select 'vínculos: placas da demo sem CR vigente', count(*)::text from demo d where not exists (select 1 from nucleo.cr_do_ativo v where v.ativo_id = d.ativo_id and v.excluido_em is null and v.fim is null)
     union all select 'vínculos: CRs de serviço da demo sem operação', count(*)::text from nucleo.cr c where c.codigo like 'DEMO-%' and c.tipo = 'servico' and not exists (select 1 from nucleo.cr_de_servico_na_operacao s where s.cr_id = c.id and s.excluido_em is null)
     union all select 'movimento: eventos de situação nos últimos 30 dias', count(*)::text from nucleo.evento_de_status e where e.excluido_em is null and e.em >= now() - interval '30 days' and e.ativo_id in (select ativo_id from demo)
     union all select 'movimento: eventos de hoje', count(*)::text from nucleo.evento_de_status e where e.excluido_em is null and e.em >= nucleo.instante_do_dia(nucleo.hoje_em_sao_paulo()) and e.ativo_id in (select ativo_id from demo)
     union all select 'movimento: siglas diferentes', count(distinct e.sigla)::text from nucleo.evento_de_status e where e.excluido_em is null and e.sigla is not null and e.ativo_id in (select ativo_id from demo)
     union all select 'movimento: correções tardias (lançadas mais de 7 dias depois do fato)', count(*)::text from nucleo.evento_de_status e where e.excluido_em is null and e.registrado_em - e.em > interval '7 days' and e.ativo_id in (select ativo_id from demo)
     union all select 'operações: placas da Operação Demo', count(*)::text from nucleo.placa_na_operacao pn join nucleo.operacao o on o.id = pn.operacao_id where o.nome = 'Operação Demo' and pn.fim is null and pn.excluido_em is null
     union all select 'operações: CRs de serviço da Operação Demo', count(*)::text from nucleo.cr_de_servico_na_operacao s join nucleo.operacao o on o.id = s.operacao_id where o.nome = 'Operação Demo' and s.excluido_em is null
     union all select 'nível 1: posições de ontem', count(*)::text from nucleo.posicao_do_conjunto where excluido_em is null and ativo_id in (select ativo_id from demo)
     union all select 'nível 1: trocas de CR registradas', count(*)::text from nucleo.troca_de_cr where ativo_id in (select ativo_id from demo)
     union all select 'nível 1: pedidos de baixa abertos', count(*)::text from nucleo.pedido_de_baixa where situacao = 'pedida' and ativo_id in (select ativo_id from demo)
     union all select 'nível 1: situações programadas', count(*)::text from nucleo.situacao_programada where situacao = 'programada' and ativo_id in (select ativo_id from demo)
     union all select 'nível 1: cidades da demo', count(*)::text from config.cidade where nome like 'Cidade Demo %'
     union all select 'nível 2: conjuntos com motorista', count(*)::text from pessoas.motorista_do_conjunto where excluido_em is null and fim is null and ativo_id in (select ativo_id from demo)
     union all select 'nível 2: dias lançados do motorista', count(*)::text from pessoas.status_do_motorista s join nucleo.pessoa p on p.id = s.pessoa_id where p.nome like 'Demo %' and s.excluido_em is null
     union all select 'nível 2: substituições', count(*)::text from pessoas.substituicao_do_motorista where excluido_em is null and ativo_id in (select ativo_id from demo)
     union all select 'nível 2: abastecimentos provisórios', count(*)::text from nucleo.abastecimento_provisorio where situacao = 'provisorio' and ativo_id in (select ativo_id from demo)
     union all select 'nível 2: ajustes pedidos da demo', count(*)::text from financeiro.ajuste where justificativa like 'Demo:%' and situacao = 'pedido'
     union all select 'faixa: parâmetro ligado', count(*)::text from config.parametro where chave = '${CHAVE_DA_FAIXA_DEMO}'`,
    [`${PREFIXO_DA_PLACA_DEMO}%`],
  );
  const resumo = Object.fromEntries(rows.map((r) => [r.item, Number(r.n)]));
  // A fila da demonstração por assunto (só placas ZDM, CRs DEMO-n e o lançamento DEMO-).
  const porAssunto = await c.query<{ assunto: string; n: string }>(
    `select coalesce(f.assunto, 'outra') as assunto, count(*)::text as n
       from nucleo.fila_de_excecoes f
      where f.resolvida_em is null
        and (f.ativo_id in (select ativo_id from nucleo.placa_do_ativo where placa like $1 and excluido_em is null)
             or f.cr_id in (select id from nucleo.cr where codigo like 'DEMO-%')
             or f.lancamento_origem_id like 'DEMO-%')
      group by 1 order by 1`,
    [`${PREFIXO_DA_PLACA_DEMO}%`],
  );
  for (const r of porAssunto.rows) resumo[`fila da demo: ${r.assunto}`] = Number(r.n);
  return resumo;
}

/**
 * Nível 1 (13/11/2026): os cenários das funções novas, só com placas ZDM, CRs DEMO-n, cidades "Cidade Demo" e
 * o lançamento DEMO-. Posição do dia (as posições de ontem dos conjuntos do 2º gestor Demo, um sem sinal),
 * Trocar CR (uma troca retroativa que muda a placa de operação), baixa pedida (para a Diretoria aprovar),
 * lançamento sem CR conhecido (Saúde do CR) e uma situação programada para amanhã.
 */
export async function carregarCenariosDoNivel1(c: pg.Client, hoje: string): Promise<number> {
  const gestores = await garantirGestoresDemo(c);
  const operacoes = await operacoesDaFrota(c);
  if (operacoes.length < 2) throw new ErroDoEixo("Faltam operações para os cenários do Nível 1.");
  const n = NUMEROS_DOS_CENARIOS;
  let novos = 0;

  // Cidades fictícias (a tabela real vem da cópia da v1; nada aqui colide com ela: id e nome próprios).
  for (const cidade of CIDADES_DA_DEMO) {
    const r = await c.query(
      `insert into config.cidade (id, nome, uf, latitude, longitude) values ($1, $2, $3, $4, $5) on conflict do nothing`,
      [cidade.id, cidade.nome, cidade.uf, cidade.latitude, cidade.longitude],
    );
    novos += r.rowCount ?? 0;
  }

  // Trocar CR: a placa nasce no CR antigo (operação 0) e troca há 20 dias para um CR ligado à operação 1.
  if (!(await ativoDaPlacaDemo(c, n.placaDaTrocaDeCr.placa))) {
    const ativo = await cadastrarCavaloDemo(
      c,
      n.placaDaTrocaDeCr.placa,
      await crDeFrotaDemo(c, n.placaDaTrocaDeCr.crAntigo),
      operacoes[0]!,
      gestores[1]!,
      hora(somarDias(hoje, -90), "08:00"),
    );
    const novo = await crDeFrotaDemo(c, n.placaDaTrocaDeCr.crNovo);
    await c.query(
      `insert into nucleo.cr_de_servico_na_operacao (cr_id, operacao_id, inicio, inicio_origem)
       select $1, $2, $3::timestamptz, 'informada'
        where not exists (select 1 from nucleo.cr_de_servico_na_operacao where cr_id = $1 and excluido_em is null)`,
      [novo, operacoes[1], hora(somarDias(hoje, -90), "08:00")],
    );
    const versao = await um<{ v: number }>(
      c,
      `select versao as v from nucleo.cr_do_ativo where ativo_id = $1 and fim is null and excluido_em is null`,
      [ativo],
    );
    // Como o Administrador (Cadastros): a troca pela função atômica, com motivo e data retroativa.
    await c.query(
      `select nucleo.trocar_cr($1::uuid, $2::uuid, $3::timestamptz, 'Demo: ordem de serviço da outra operação', 'informada', $4::integer)`,
      [ativo, novo, hora(somarDias(hoje, -20), "00:00"), versao.v],
    );
    novos++;
  }

  // Baixa pedida: o gestor Demo pediu a venda; a Diretoria aprova (quatro olhos). Gravada como o pedido grava.
  if (!(await ativoDaPlacaDemo(c, n.placaDaBaixaPedida.placa))) {
    const ativo = await cadastrarCavaloDemo(
      c,
      n.placaDaBaixaPedida.placa,
      await crDeFrotaDemo(c, n.placaDaBaixaPedida.cr),
      operacoes[0]!,
      gestores[1]!,
      hora(somarDias(hoje, -120), "08:00"),
    );
    await c.query(
      `insert into nucleo.pedido_de_baixa (ativo_id, motivo, sigla, em, justificativa, pedido_por, pedido_em)
       values ($1, 'venda', 'VND', $2::timestamptz, 'Demo: venda do cavalo (o contrato fica no documento)', $3, $4::timestamptz)`,
      [ativo, hora(hoje, "00:00"), gestores[1], hora(somarDias(hoje, -2), "10:00")],
    );
    novos++;
  }

  // Posição de ontem dos conjuntos do 2º gestor Demo (a porta de hoje já traz "Continua em").
  const ontem = somarDias(hoje, -1);
  const conjuntos = (
    await c.query<{ ativo_id: string }>(
      `select g.ativo_id from nucleo.gestor_da_carteira g
         join nucleo.ativo a on a.id = g.ativo_id and a.excluido_em is null and a.tipo in ('cavalo', 'caminhao')
         join nucleo.placa_do_ativo p on p.ativo_id = a.id and p.fim is null and p.excluido_em is null
        where g.gestor_id = $1 and g.fim is null and g.excluido_em is null and p.placa like $2
          and not exists (select 1 from nucleo.baixa_do_ativo b where b.ativo_id = a.id and b.excluido_em is null)
        order by p.placa, g.ativo_id`,
      [gestores[1], `${PREFIXO_DA_PLACA_DEMO}%`],
    )
  ).rows;
  for (const [i, k] of conjuntos.entries()) {
    const p = posicaoDeOntem(i);
    const r = await c.query(
      `insert into nucleo.posicao_do_conjunto (ativo_id, dia, cidade_id, origem, sem_sinal, motivo, registrado_por)
       select $1, $2::date, $3, 'gestor', $4, case when $4 then 'Demo: rastreador desligado' end, $5
        where not exists (select 1 from nucleo.posicao_do_conjunto
                           where ativo_id = $1 and dia = $2::date and origem = 'gestor' and excluido_em is null)`,
      [k.ativo_id, ontem, p.cidadeId, p.semSinal, gestores[1]],
    );
    novos += r.rowCount ?? 0;
    if (p.semSinal) {
      await c.query(
        `insert into nucleo.fila_de_excecoes (ativo_id, assunto, descricao)
         values ($1, 'posicao_pendente', 'Conjunto sem sinal na Posição do dia (demonstração).')
         on conflict (ativo_id, assunto) where resolvida_em is null and ativo_id is not null and assunto is not null do nothing`,
        [k.ativo_id],
      );
    }
  }

  // Lançamento sem CR conhecido (Saúde do CR): sem competência, nunca entra em total algum.
  const r = await c.query(
    `insert into staging.despesa (origem_id, nufin, codcencus, dt_competencia, valor_liquido)
     values ('DEMO-SEM-CR-1', 'DEMO-2', $1, null, 1.00), ('DEMO-SEM-CR-2', 'DEMO-3', $1, null, 2.00)
     on conflict (origem_id) do nothing`,
    [n.centroSemCr],
  );
  novos += r.rowCount ?? 0;

  // Programado: o primeiro cavalo do 2º gestor fica em pátio amanhã (fora do realizado até confirmar).
  if (conjuntos[0]) {
    const jaTem = await um<{ n: string }>(
      c,
      `select count(*)::text as n from nucleo.situacao_programada where ativo_id = $1 and situacao = 'programada'`,
      [conjuntos[0].ativo_id],
    );
    if (Number(jaTem.n) === 0) {
      await c.query(`select nucleo.programar_situacao($1::uuid, $2::date, 'PÁT', '07:00')`, [
        conjuntos[0].ativo_id,
        somarDias(hoje, 1),
      ]);
      novos++;
    }
  }
  return novos;
}

/**
 * Nível 2, A6 (13/11/2026): os motoristas Demo dos cavalos ZDM 1 a 10 (vínculo desde o início do vínculo da pessoa),
 * o realizado dos últimos 10 dias pela sugestão da escala (hoje fica sem lançamento), férias sem substituto no
 * motorista do ZDM 1 (a tarefa "Indicar substituto") e férias com substituto no do ZDM 2. Só pessoas "Demo".
 */
export async function carregarMotoristasDaDemo(c: pg.Client, hoje: string): Promise<number> {
  const motoristas = (
    await c.query<{ pessoa_id: string; inicio: string; operacao_id: string }>(
      `select v.pessoa_id, v.inicio::text as inicio, v.operacao_id
         from pessoas.vinculo v join nucleo.pessoa p on p.id = v.pessoa_id
        where p.nome like 'Demo %' and v.funcao = 'motorista' and v.excluido_em is null and v.periodo @> $1::date
        order by p.nome, v.pessoa_id`,
      [hoje],
    )
  ).rows;
  if (motoristas.length < 11)
    throw new ErroDoEixo("Faltam motoristas Demo para os cenários do A6.");
  let novos = 0;
  const conjuntos: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const ativo = await exigirAtivoDaPlacaDemo(c, i);
    conjuntos.push(ativo);
    const ja = await um<{ n: string }>(
      c,
      `select count(*)::text as n from pessoas.motorista_do_conjunto where ativo_id = $1 and excluido_em is null`,
      [ativo],
    );
    if (Number(ja.n) > 0) continue;
    const m = motoristas[i - 1]!;
    await c.query(`select nucleo.vincular_motorista($1::uuid, $2::uuid, $3::date)`, [
      ativo,
      m.pessoa_id,
      m.inicio,
    ]);
    novos++;
  }
  // O realizado dos últimos 10 dias, pela sugestão da escala (o gestor "lançou" o que estava planejado).
  for (const m of motoristas.slice(0, 10)) {
    const r = await um<{ n: string }>(
      c,
      `select count(nucleo.lancar_status_do_motorista(e.pessoa_id, e.dia, cm.codigo))::text as n
         from pessoas.marcacao_da_escala e
         join pessoas.codigo_do_motorista cm on cm.sugerido_pela_escala = e.sigla
        where e.pessoa_id = $1 and e.dia between $2::date - 10 and $2::date - 1
          and not exists (select 1 from pessoas.status_do_motorista s
                           where s.pessoa_id = e.pessoa_id and s.dia = e.dia and s.excluido_em is null)`,
      [m.pessoa_id, hoje],
    );
    novos += Number(r.n);
  }
  // Férias na escala: o do ZDM 1 sem substituto (tarefa); o do ZDM 2 com o 11º motorista de substituto.
  const ferias = [
    { m: motoristas[0]!, de: 3, ate: 6 },
    { m: motoristas[1]!, de: 4, ate: 7 },
  ];
  for (const f of ferias) {
    for (let d = f.de; d <= f.ate; d++) {
      const r = await c.query(
        `select nucleo.marcar_escala($1::uuid, $2::uuid, $3::date, 'FE')
          where not exists (select 1 from pessoas.marcacao_da_escala where pessoa_id = $1 and dia = $3::date)`,
        [f.m.pessoa_id, f.m.operacao_id, somarDias(hoje, d)],
      );
      novos += r.rowCount ?? 0;
    }
  }
  const temSubstituto = await um<{ n: string }>(
    c,
    `select count(*)::text as n from pessoas.substituicao_do_motorista where ativo_id = $1 and excluido_em is null`,
    [conjuntos[1]],
  );
  if (Number(temSubstituto.n) === 0) {
    await c.query(
      `select nucleo.indicar_substituto($1::uuid, $2::uuid, $3::date, $4::date, 'Demo: férias do titular')`,
      [motoristas[1]!.pessoa_id, motoristas[10]!.pessoa_id, somarDias(hoje, 4), somarDias(hoje, 8)],
    );
    novos++;
  }
  return novos;
}

/**
 * Nível 2: três abastecimentos lançados à mão (provisórios) nas placas ZDM 1 a 3, de ontem e de hoje, à espera
 * da conferência com o Sankhya. Nunca somam no total do mês. Idempotente pelo posto "Posto Demo".
 */
export async function carregarAbastecimentoProvisorioDaDemo(
  c: pg.Client,
  hoje: string,
): Promise<number> {
  let novos = 0;
  for (let i = 1; i <= 3; i++) {
    const ativo = await exigirAtivoDaPlacaDemo(c, i);
    const ja = await um<{ n: string }>(
      c,
      `select count(*)::text as n from nucleo.abastecimento_provisorio where ativo_id = $1 and posto = 'Posto Demo'`,
      [ativo],
    );
    if (Number(ja.n) > 0) continue;
    await c.query(
      `select nucleo.lancar_abastecimento_provisorio($1::uuid, $2::date, $3, $4, null, 'Diesel S10', 'Posto Demo')`,
      [ativo, somarDias(hoje, i === 3 ? 0 : -1), 120 + i * 10, (120 + i * 10) * 6.2],
    );
    novos++;
  }
  return novos;
}

/**
 * Nível 2, Resultados: dois ajustes pedidos na "Operação Demo" (um de custo da frota, um de receita) para a
 * Diretoria decidir. O ajuste não entra em total nenhum (nem na Visão geral nem na foto). Nenhum mês é fechado
 * pela demonstração: fechar é da Diretoria e congelaria um mês real. Idempotente pela justificativa "Demo:".
 */
export async function carregarAjustesDaDemo(c: pg.Client, hoje: string): Promise<number> {
  const operacao = await um<{ id: string } | undefined>(
    c,
    `select id from nucleo.operacao where nome = $1 and excluido_em is null`,
    [NOME_DA_OPERACAO_DEMO],
  );
  if (!operacao) return 0;
  const ja = await um<{ n: string }>(
    c,
    `select count(*)::text as n from financeiro.ajuste where justificativa like 'Demo:%'`,
  );
  if (Number(ja.n) > 0) return 0;
  const mes = `${somarDias(hoje, -40).slice(0, 7)}-01`;
  await c.query(
    `select nucleo.pedir_ajuste($1::date, $2::uuid, null, 'custo_frota', -150.00, 'Demo: nota de manutenção lançada em dobro')`,
    [mes, operacao.id],
  );
  await c.query(
    `select nucleo.pedir_ajuste($1::date, $2::uuid, null, 'receita', 320.00, 'Demo: frete prestado sem CT-e emitido')`,
    [mes, operacao.id],
  );
  return 2;
}

export async function carregarDemo(
  c: pg.Client,
): Promise<{ areas: Record<string, string>; abastecimento: number }> {
  const hoje = (await um<{ d: string }>(c, `select nucleo.hoje_em_sao_paulo()::text as d`)).d;
  await assumirAdministrador(c);
  const areas: Record<string, string> = {};
  await carregarParceiros(c);
  areas["parceiros"] = "ok";
  areas["pessoas e escala"] = `${await carregarPessoasEEscala(c, hoje)} marcações novas`;
  areas["frota, operacional, acompanhamento, pedidos e locação"] = await carregarFrota(c, hoje);
  const abastecimento = await carregarAbastecimento(c, hoje);
  areas["tarefas: pedidos em atraso e em conferência"] =
    `${await carregarPedidosEmAtraso(c, hoje)} pedidos novos`;
  areas["movimento: situações dos últimos dias"] =
    `${await carregarMovimento(c, hoje)} lançamentos novos`;
  areas["vínculos com história"] = `${await carregarVinculosComHistoria(c, hoje)} placas novas`;
  areas["fila de exceções"] = `${await carregarExcecoes(c, hoje)} exceções novas`;
  areas["Operação Demo (sem lançamentos)"] = `${await carregarOperacaoDemo(c, hoje)} placas novas`;
  areas["Nível 1: posição, troca de CR, baixa pedida, sem CR e programado"] =
    `${await carregarCenariosDoNivel1(c, hoje)} itens novos`;
  areas["Nível 2: motoristas, realizado do dia e substituto"] =
    `${await carregarMotoristasDaDemo(c, hoje)} itens novos`;
  areas["Nível 2: abastecimentos provisórios"] =
    `${await carregarAbastecimentoProvisorioDaDemo(c, hoje)} lançamentos novos`;
  areas["Nível 2: ajustes pedidos (Operação Demo)"] =
    `${await carregarAjustesDaDemo(c, hoje)} ajustes novos`;
  await ligarFaixaDaDemo(c);
  areas["faixa de demonstração"] = "ligada";
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
