import { describe, expect, it } from "vitest";
import {
  chaveMestraForaDosWorkers,
  fksSemIndice,
  listarArquivos,
  lerTexto,
  politicasSemTeste,
  securityDefinerSemJustificativa,
  selectEstrela,
  serverActionSemGuarda,
  softDeleteSemIndiceParcial,
} from "./armadilhas";

// Armadilhas conhecidas (docs/decisoes.md e CLAUDE.md). Cada bloco prova a verificação com um
// exemplo bom e um ruim e, no fim, aplica a verificação ao repositório de verdade.

describe("armadilha 13: índice em toda chave estrangeira", () => {
  it("acusa chave estrangeira sem índice", () => {
    const sql = `create table nucleo.placa (
      id uuid primary key,
      operacao_id uuid not null references nucleo.operacao (id)
    );`;
    expect(fksSemIndice(sql)).toEqual(["nucleo.placa.operacao_id"]);
  });
  it("aceita chave estrangeira com índice próprio", () => {
    const sql = `create table nucleo.placa (
      id uuid primary key,
      operacao_id uuid not null references nucleo.operacao (id)
    );
    create index placa_operacao_idx on nucleo.placa (operacao_id);`;
    expect(fksSemIndice(sql)).toEqual([]);
  });
  it("aceita chave estrangeira que já abre a chave primária composta", () => {
    const sql = `create table nucleo.vinculo (
      placa_id uuid not null references nucleo.placa (id),
      cr_id uuid not null references nucleo.cr (id),
      primary key (placa_id, cr_id)
    );`;
    expect(fksSemIndice(sql)).toEqual(["nucleo.vinculo.cr_id"]);
  });
  it("lê chave estrangeira declarada no fim da tabela", () => {
    const sql = `create table nucleo.placa (
      id uuid primary key,
      operacao_id uuid not null,
      foreign key (operacao_id) references nucleo.operacao (id)
    );`;
    expect(fksSemIndice(sql)).toEqual(["nucleo.placa.operacao_id"]);
  });
  it("ignora comentário", () => {
    const sql = `create table nucleo.placa (
      id uuid primary key
      -- operacao_id uuid references nucleo.operacao (id)
    );`;
    expect(fksSemIndice(sql)).toEqual([]);
  });
});

describe("armadilha 13: índice parcial para exclusão lógica", () => {
  it("acusa exclusão lógica sem índice parcial", () => {
    expect(softDeleteSemIndiceParcial("alter table a add column excluido_em timestamptz;")).toBe(
      true,
    );
  });
  it("aceita com índice parcial", () => {
    const sql = `alter table a add column excluido_em timestamptz;
    create index a_ativos_idx on a (nome) where excluido_em is null;`;
    expect(softDeleteSemIndiceParcial(sql)).toBe(false);
  });
  it("não cobra de quem não usa exclusão lógica", () => {
    expect(softDeleteSemIndiceParcial("create table a (id int);")).toBe(false);
  });
});

describe("armadilha 10: SECURITY DEFINER só com justificativa", () => {
  it("acusa a função sem justificativa", () => {
    const sql = `create function f() returns int
language sql
security definer
as $$ select 1 $$;`;
    expect(securityDefinerSemJustificativa(sql)).toEqual([3]);
  });
  it("aceita com a justificativa registrada ao lado", () => {
    const sql = `-- justificativa: lê a tabela de permissões, que o usuário não enxerga.
create function f() returns int
language sql
security definer
as $$ select 1 $$;`;
    expect(securityDefinerSemJustificativa(sql)).toEqual([]);
  });
  it("não confunde com security invoker", () => {
    expect(securityDefinerSemJustificativa("create function f() security invoker;")).toEqual([]);
  });
});

describe("armadilha 9: toda política RLS tem teste pgTAP", () => {
  it("acusa política sem teste", () => {
    const sql = `create policy "placa_leitura" on nucleo.placa for select to authenticated using (true);`;
    expect(politicasSemTeste(sql, "select plan(1);")).toEqual(["placa_leitura"]);
  });
  it("aceita política que o teste cita", () => {
    const sql = `create policy placa_leitura on nucleo.placa for select to authenticated using (true);`;
    expect(politicasSemTeste(sql, "-- placa_leitura: gestor vê só a sua filial")).toEqual([]);
  });
});

describe("armadilha 9: a chave mestra só existe nos workers", () => {
  it("acusa uso fora dos workers", () => {
    expect(
      chaveMestraForaDosWorkers([
        { caminho: "app/a.ts", texto: "SUPABASE_SECRET_KEY" },
        { caminho: "app/b.ts", texto: "sb_secret_abc" },
        { caminho: "e2e/apoio/usuarios-de-teste.ts", texto: "SECRET_KEY" },
      ]),
    ).toEqual(["app/a.ts", "app/b.ts"]);
    expect(chaveMestraForaDosWorkers([{ caminho: "app/x.ts", texto: "service_role" }])).toEqual([
      "app/x.ts",
    ]);
    expect(
      chaveMestraForaDosWorkers([
        { caminho: "supabase/tests/a.sql", texto: "set role service_role;" },
      ]),
    ).toEqual(["supabase/tests/a.sql"]);
  });
  it("deixa passar os workers", () => {
    expect(
      chaveMestraForaDosWorkers([
        { caminho: "workers/sync.py", texto: "SUPABASE_SERVICE_ROLE_KEY" },
      ]),
    ).toEqual([]);
  });
});

describe("armadilha 14: consultas pedem só as colunas necessárias", () => {
  it("acusa select *", () => {
    expect(selectEstrela('supabase.from("placa").select("*")')).toBe(true);
    expect(selectEstrela("select * from nucleo.placa")).toBe(true);
  });
  it("aceita colunas nomeadas", () => {
    expect(selectEstrela('supabase.from("placa").select("id, placa")')).toBe(false);
  });
});

describe("armadilha 8: toda Server Action valida e confere permissão", () => {
  it("acusa Server Action sem Zod nem permissão", () => {
    expect(serverActionSemGuarda('"use server";\nexport async function a() {}')).toEqual([
      "validar a entrada com Zod (safeParse ou parse)",
      "conferir permissão com exigirPermissao()",
    ]);
  });
  it("aceita Server Action com as duas guardas", () => {
    const texto = `"use server";
export async function a(x: unknown) {
  await exigirPermissao("frota", "editar");
  return esquema.safeParse(x);
}`;
    expect(serverActionSemGuarda(texto)).toEqual([]);
  });
  it("ignora arquivo que não é Server Action", () => {
    expect(serverActionSemGuarda("export const a = 1;")).toEqual([]);
  });
  it("ação pública (entrar, recuperar a senha) dispensa exigirPermissao só com a justificativa ao lado; o Zod continua", () => {
    const publica = `"use server";
// ação pública: quem entra ainda não tem sessão.
export async function entrar(x: unknown) {
  return esquema.safeParse(x);
}`;
    expect(serverActionSemGuarda(publica)).toEqual([]);
    expect(
      serverActionSemGuarda(
        publica.replace("// ação pública: quem entra ainda não tem sessão.", "// ação pública:"),
      ),
    ).toEqual(["conferir permissão com exigirPermissao()"]);
    expect(serverActionSemGuarda(publica.replace("esquema.safeParse(x)", "x"))).toEqual([
      "validar a entrada com Zod (safeParse ou parse)",
    ]);
  });
});

describe("no repositório de verdade", () => {
  const migracoes = listarArquivos("supabase/migrations", /\.sql$/)
    .map(lerTexto)
    .join("\n");
  const testesDoBanco = listarArquivos("supabase/tests", /\.sql$/)
    .map(lerTexto)
    .join("\n");

  it("toda chave estrangeira tem índice", () => {
    expect(fksSemIndice(migracoes)).toEqual([]);
  });
  it("toda exclusão lógica tem índice parcial", () => {
    expect(softDeleteSemIndiceParcial(migracoes)).toBe(false);
  });
  it("todo SECURITY DEFINER tem justificativa registrada", () => {
    expect(securityDefinerSemJustificativa(migracoes)).toEqual([]);
  });
  it("toda política RLS tem teste pgTAP", () => {
    expect(politicasSemTeste(migracoes, testesDoBanco)).toEqual([]);
  });
  it("a chave mestra não aparece fora de workers/", () => {
    const arquivos = ["app", "components", "lib", "e2e", "supabase/tests"]
      .flatMap((pasta) => listarArquivos(pasta, /\.(ts|tsx|sql|mjs)$/))
      .filter((caminho) => !caminho.startsWith("lib/qualidade/armadilhas"))
      .map((caminho) => ({ caminho, texto: lerTexto(caminho) }));
    expect(chaveMestraForaDosWorkers(arquivos)).toEqual([]);
  });
  it("as consultas de lib/dados não usam select *", () => {
    const abusos = listarArquivos("lib/dados", /\.ts$/)
      .filter((caminho) => !caminho.endsWith(".test.ts"))
      .filter((caminho) => selectEstrela(lerTexto(caminho)));
    expect(abusos).toEqual([]);
  });
  it("toda Server Action valida a entrada e confere permissão", () => {
    const faltas = ["app", "lib"]
      .flatMap((pasta) => listarArquivos(pasta, /\.(ts|tsx)$/))
      .filter((caminho) => !caminho.endsWith(".test.ts") && !caminho.endsWith(".test.tsx"))
      .map((caminho) => ({ caminho, faltas: serverActionSemGuarda(lerTexto(caminho)) }))
      .filter((r) => r.faltas.length > 0);
    expect(faltas).toEqual([]);
  });
});
