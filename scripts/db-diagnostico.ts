// `pnpm db:diagnostico -- --rotulo 5000 --saida diagnostico.md`: o diagnóstico da lista de placas no
// Supabase LOCAL (fatia 3.9a). Mede, SEM limite de tempo (statement_timeout 0 só aqui), a lista, os
// chips e o detalhe e cada peça da linha separada (situação, alertas, operação, CR e filial, a RLS),
// como o dono do banco (sem RLS), o Administrador e um Gestor, com EXPLAIN (ANALYZE, BUFFERS) das
// consultas que mostram o plano. Grava o relatório a cada consulta (o parcial fica se o job cair).
// Recusa banco que não seja local; nunca imprime endereço nem chave.
import { execSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { bancoLocal } from "./db-dev-dados.ts";
import { ErroDoEixo, textoDoErro } from "../lib/log/erro.ts";

const MIGRATION = "supabase/migrations/20261104200000_leitura_das_placas.sql";

/** A linha da lista SEM os alertas (o mesmo texto da visão, sem a junção dos alertas). */
export function linhaSemAlertas(migration: string): string {
  const inicio = "create view nucleo.linha_de_placa with (security_invoker = true) as";
  const fim = ";\ncomment on view nucleo.linha_de_placa";
  const a = migration.indexOf(inicio);
  const b = migration.indexOf(fim, a);
  if (a < 0 || b < 0) throw new ErroDoEixo("Não achei a visão linha_de_placa na migration.");
  let corpo = migration.slice(a + inicio.length, b);
  const coluna = "    al.alertas,\n";
  const juncao = corpo.slice(
    corpo.indexOf("  left join lateral (\n    select array(select v.alerta"),
    corpo.indexOf(") al on true\n") + ") al on true\n".length,
  );
  if (!corpo.includes(coluna) || !juncao.startsWith("  left join lateral")) {
    throw new ErroDoEixo("Não achei os alertas na visão linha_de_placa.");
  }
  corpo = corpo.replace(coluna, "").replace(juncao, "");
  return corpo;
}

interface Medida {
  nome: string;
  sql: string;
  plano?: boolean;
}

function medidas(semAlertas: string): Medida[] {
  // As peças primeiro e o que pode demorar mais (a lista inteira) por último.
  return [
    {
      nome: "peça: situação de todas (situacao_com_causa)",
      sql: "select count(*) from nucleo.ativo a cross join lateral nucleo.situacao_com_causa(a.id, now()) s where a.excluido_em is null",
    },
    {
      nome: "peça: operação de todas (operacao_em)",
      sql: "select count(*) from nucleo.ativo a where nucleo.operacao_em(a.id, now()) is not null",
    },
    {
      nome: "peça: filial do CR de todas (filial_do_cr_em)",
      sql: "select count(*) from nucleo.ativo a where nucleo.filial_do_cr_em(a.id, now()) is not null",
    },
    {
      nome: "peça: a RLS (config.ve_ativo) em todas",
      sql: "select count(*) from nucleo.ativo a where config.ve_ativo(a.id, array['frota', 'operacional'], 'ver')",
    },
    {
      nome: "peça: alertas, visão inteira (alerta_de_vinculo)",
      sql: "select count(*) from nucleo.alerta_de_vinculo",
      plano: true,
    },
    {
      nome: "peça: alertas de UMA placa (o filtro desce?)",
      sql: "select count(*) from nucleo.alerta_de_vinculo where ativo_id = (select id from nucleo.ativo order by id limit 1)",
      plano: true,
    },
    {
      nome: "visão SEM os alertas: count(*)",
      sql: `select count(*) from (${semAlertas}) x`,
      plano: true,
    },
    {
      nome: "detalhe (detalhe_da_placa)",
      sql: "select nucleo.detalhe_da_placa((select placa from nucleo.placa_atual order by placa limit 1))",
    },
    {
      nome: "visão, 25 primeiras por placa",
      sql: "select * from nucleo.linha_de_placa order by placa, id limit 25",
      plano: true,
    },
    {
      nome: "lista, página 1 (listar_placas)",
      sql: "select nucleo.listar_placas('', '{}', '{}', '{}', false, 'placa', false, 1, 25)",
    },
    {
      nome: "lista filtrada por PÁT (listar_placas)",
      sql: "select nucleo.listar_placas('', '{}', '{}', '{PÁT}', false, 'placa', false, 1, 25)",
    },
    {
      nome: "chips (contar_chips_de_placas)",
      sql: "select * from nucleo.contar_chips_de_placas('', '{}', '{}', '{}', false)",
    },
  ];
}

function enderecoDoBancoLocal(): string {
  const texto = execSync("pnpm exec supabase status -o env", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const linha = texto.split(/\r?\n/).find((l) => l.startsWith("DB_URL="));
  const endereco = linha?.replace(/^DB_URL="?/, "").replace(/"$/, "");
  if (!endereco)
    throw new ErroDoEixo("O supabase status não trouxe o banco: o Supabase local está ligado?");
  return endereco;
}

async function principal() {
  const argv = process.argv.slice(2);
  const valor = (nome: string) => {
    const i = argv.indexOf(nome);
    return i >= 0 ? (argv[i + 1] ?? null) : null;
  };
  const saida = valor("--saida") ?? "diagnostico-da-lista.md";
  const rotulo = valor("--rotulo") ?? "?";
  const endereco = enderecoDoBancoLocal();
  if (!bancoLocal(endereco))
    throw new ErroDoEixo("Recusado: o diagnóstico só roda no Supabase local.");
  const escrever = (...linhas: string[]) => {
    const texto = linhas.join("\n");
    appendFileSync(saida, `${texto}\n`, "utf8");
    console.log(texto);
  };
  if (!existsSync(saida))
    writeFileSync(saida, "# Diagnóstico da lista de placas (modo banco)\n\n", "utf8");

  const cliente = new pg.Client({ connectionString: endereco });
  await cliente.connect();
  try {
    const n = (
      await cliente.query<{ n: string }>(
        "select count(*) as n from nucleo.ativo where excluido_em is null",
      )
    ).rows[0]!.n;
    escrever(`## ${rotulo}: ${n} ativos no banco`);
    await cliente.query("begin");
    // Usuários de medição, só nesta transação: um Administrador e o gestor com mais placas.
    const quem = (
      await cliente.query<{ adm: string; gestor: string; placas: string }>(`
        with adm as (insert into nucleo.pessoa (nome) values ('Medição Administrador') returning id),
        doc as (insert into nucleo.pessoa_documento (pessoa_id, documento) select id, '52998224725' from adm returning pessoa_id),
        u1 as (insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
               values (gen_random_uuid(), 'authenticated', 'authenticated', 'medicao.adm@eixo.local', '{}', '{}', now(), now()) returning id),
        u2 as (insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
               values (gen_random_uuid(), 'authenticated', 'authenticated', 'medicao.gestor@eixo.local', '{}', '{}', now(), now()) returning id),
        v1 as (insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) select doc.pessoa_id, u1.id, 'administrador' from doc, u1 returning auth_user_id),
        g as (select p.id from nucleo.pessoa p where p.nome = 'Ana Ribeiro'),
        v2 as (insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) select g.id, u2.id, 'gestor_de_frota' from g, u2 returning auth_user_id)
        select (select auth_user_id from v1) as adm, (select auth_user_id from v2) as gestor,
               (select count(*) from nucleo.gestor_da_carteira c, g where c.gestor_id = g.id and c.fim is null and c.excluido_em is null)::text as placas`)
    ).rows[0]!;
    escrever(`Gestor medido: Ana Ribeiro, ${quem.placas} placas na carteira.`);
    // Dispara agora os gatilhos adiados das pessoas de medição (senão o ALTER TABLE das escritas recusa).
    await cliente.query("set constraints all immediate");
    await cliente.query("set constraints all deferred");
    const semAlertas = linhaSemAlertas(readFileSync(MIGRATION, "utf8"));

    for (const [perfil, id] of [
      ["Dono do banco (sem RLS)", null],
      ["Gestor de frota", quem.gestor],
      ["Administrador", quem.adm],
    ] as const) {
      escrever("", `### ${perfil}`, "", "| Medida | ms |", "|---|---:|");
      await cliente.query("savepoint como");
      if (id) {
        await cliente.query(
          `select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true),
                  set_config('request.jwt.claim.role', 'authenticated', true)`,
          [JSON.stringify({ sub: id, role: "authenticated" }), id],
        );
        await cliente.query("set local role authenticated");
      }
      await cliente.query("set local statement_timeout = 0");
      for (const m of medidas(semAlertas)) {
        const inicio = performance.now();
        // A consulta com plano roda uma vez só, já pelo EXPLAIN ANALYZE (o tempo é o mesmo).
        const plano = m.plano
          ? (await cliente.query<{ "QUERY PLAN": string }>(`explain (analyze, buffers) ${m.sql}`))
              .rows
          : (await cliente.query(m.sql), null);
        escrever(`| ${m.nome} | ${Math.round(performance.now() - inicio)} |`);
        if (plano) {
          appendFileSync(
            saida,
            [
              "",
              `#### Plano (${perfil}): ${m.nome}`,
              "",
              "```",
              ...plano.map((l) => l["QUERY PLAN"]),
              "```",
              "",
            ].join("\n"),
            "utf8",
          );
        }
      }
      await cliente.query("rollback to savepoint como");
    }
    // Equivalência de dados (a leitura mantida é igual ao calculado agora pelas funções) e de
    // segurança (cada perfil vê na tabela exatamente o que config.ve_ativo deixa).
    const amostra = Number(n) > 1000 ? 1000 : Number(n);
    const divergentes = (
      await cliente.query<{ n: string }>(
        `select count(*) as n from (select id from nucleo.ativo where excluido_em is null order by md5(id::text) limit $1) a
          where (select (to_jsonb(l) - 'recalculado_em') from nucleo.leitura_da_placa l where l.ativo_id = a.id)
                is distinct from (to_jsonb(nucleo.linha_calculada_da_placa(a.id)) - 'recalculado_em')`,
        [amostra],
      )
    ).rows[0]!.n;
    escrever(
      "",
      `### Equivalência (${amostra} placas)`,
      "",
      `Linhas diferentes do calculado: ${divergentes}.`,
    );
    const falhas: string[] = Number(divergentes) > 0 ? [`${divergentes} linhas divergentes`] : [];
    for (const [perfil, id] of [
      ["Administrador", quem.adm],
      ["Gestor de frota", quem.gestor],
    ] as const) {
      await cliente.query("savepoint seg");
      await cliente.query(
        `select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true),
                set_config('request.jwt.claim.role', 'authenticated', true)`,
        [JSON.stringify({ sub: id, role: "authenticated" }), id],
      );
      const ids = (
        await cliente.query<{ id: string }>("select id from nucleo.ativo where excluido_em is null")
      ).rows.map((r) => r.id);
      await cliente.query("set local role authenticated");
      const visibilidade = (
        await cliente.query<{ n: string }>(
          `select count(*) as n from unnest($1::uuid[]) t (id)
            where config.ve_ativo(t.id, array['frota', 'operacional'], 'ver')
                  is distinct from exists (select 1 from nucleo.leitura_da_placa l where l.ativo_id = t.id)`,
          [ids],
        )
      ).rows[0]!.n;
      escrever(`${perfil}: placas em que a tabela e ve_ativo discordam: ${visibilidade}.`);
      if (Number(visibilidade) > 0)
        falhas.push(`${perfil}: ${visibilidade} placas com visibilidade diferente`);
      await cliente.query("rollback to savepoint seg");
    }

    // O tempo das escritas, com e sem os gatilhos da leitura mantida (o fim da transação incluído).
    escrever(
      "",
      "### Escritas (ms, com o recálculo no fim da transação)",
      "",
      "| Escrita | com gatilhos | sem gatilhos |",
      "|---|---:|---:|",
    );
    const alvo = (
      await cliente.query<{ cavalo: string; implemento: string; solo: string }>(`
        select
          (select c.cavalo_id from nucleo.composicao c
            where c.excluido_em is null and c.periodo @> now()
              and nucleo.situacao_atual(c.cavalo_id) in ('PÁT', 'ETv', 'DOp')
              and (select count(*) from nucleo.composicao x where x.cavalo_id = c.cavalo_id and x.excluido_em is null and x.periodo @> now()) = 1
            order by c.cavalo_id limit 1) as cavalo,
          (select c.implemento_id from nucleo.composicao c
            where c.excluido_em is null and c.periodo @> now()
              and nucleo.situacao_atual(c.cavalo_id) in ('PÁT', 'ETv', 'DOp')
              and (select count(*) from nucleo.composicao x where x.cavalo_id = c.cavalo_id and x.excluido_em is null and x.periodo @> now()) = 1
            order by c.cavalo_id limit 1) as implemento,
          (select a.id from nucleo.ativo a
            where a.tipo = 'cavalo' and a.excluido_em is null and nucleo.situacao_atual(a.id) = 'PÁT'
              and not exists (select 1 from nucleo.composicao x where x.cavalo_id = a.id and x.excluido_em is null and x.periodo @> now())
            order by a.id limit 1) as solo`)
    ).rows[0]!;
    const TABELAS = [
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
    const cronometrar = async (sql: string, parametros: unknown[]) => {
      const inicio = performance.now();
      await cliente.query(sql, parametros);
      await cliente.query("set constraints all immediate");
      await cliente.query("set constraints all deferred");
      return Math.round(performance.now() - inicio);
    };
    const escritas: [string, string, unknown[]][] = [
      [
        "desatrelar e engatar de novo",
        "select nucleo.desatrelar($1, clock_timestamp()), nucleo.engatar($1, $2, 1::smallint, clock_timestamp() + interval '1 second')",
        [alvo.cavalo, alvo.implemento],
      ],
      [
        "registrar evento (ETv)",
        "select nucleo.registrar_evento($1, 'ETv', clock_timestamp() + interval '2 seconds')",
        [alvo.solo],
      ],
    ];
    for (const [nome, sql, parametros] of escritas) {
      if (parametros.some((p) => p === null)) {
        escrever(`| ${nome} | sem placa para medir | |`);
        continue;
      }
      await cliente.query("savepoint escrita");
      const com = await cronometrar(sql, parametros);
      // Depois da escrita: a leitura das placas tocadas continua igual ao calculado.
      const depois = (
        await cliente.query<{ n: string }>(
          `select count(*) as n from unnest($1::uuid[]) t (id)
            where (select (to_jsonb(l) - 'recalculado_em') from nucleo.leitura_da_placa l where l.ativo_id = t.id)
                  is distinct from (to_jsonb(nucleo.linha_calculada_da_placa(t.id)) - 'recalculado_em')`,
          [parametros],
        )
      ).rows[0]!.n;
      if (Number(depois) > 0)
        falhas.push(`${nome}: ${depois} linhas divergentes depois da escrita`);
      await cliente.query("rollback to savepoint escrita");
      for (const tabela of TABELAS)
        await cliente.query(`alter table nucleo.${tabela} disable trigger t99_leitura_da_placa`);
      const sem = await cronometrar(sql, parametros);
      await cliente.query("rollback to savepoint escrita");
      escrever(`| ${nome} | ${com} | ${sem} |`);
    }
    if (falhas.length > 0) {
      escrever("", `**FALHOU:** ${falhas.join("; ")}.`);
      process.exitCode = 1;
    }
    await cliente.query("rollback");
  } finally {
    await cliente.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((erro: unknown) => {
    console.error(textoDoErro(erro));
    process.exit(1);
  });
}
