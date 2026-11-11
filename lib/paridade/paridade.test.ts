import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { arquivosDoApp } from "./arquivos-do-app.ts";
import {
  compararParidade,
  conteinerDoBanco,
  lerDoBanco,
  embrulhosDeRpc,
  funcoesDosTipos,
  nomesDosArgumentos,
  relatorioDeParidade,
  usosDoApp,
  type FuncaoDoBanco,
} from "./paridade.ts";

const CODIGO = `
async function ler(c: X, funcao: string, argumentos: object) {
  return c.schema("nucleo").rpc(funcao, argumentos);
}
async function a(c: X) {
  await c.schema("config").rpc("perfil_atual");
  await c.schema("nucleo").rpc("pessoas_da_lista", { p_pessoa: 1 });
  return ler<Json>(c, "operacoes_do_mes", {});
}
const escrever = async <T,>(
  c: X,
  funcao: string,
) => c;
await escrever(c, "marcar_escala");
`;

const TIPOS = `
export type Database = {
  "config": {
          Tables: {
          }
          Functions: {
            "perfil_atual":
{ Args: Record<PropertyKey, never>; Returns: string
                           }
          }
          Enums: {
  }
  "nucleo": {
          Tables: {
          }
          Functions: {
            "pessoas_da_lista":
{ Args: { "p_pessoa"?: string,"p_tam"?: number }; Returns: Json
                           },
"operacoes_do_mes":
{ Args: { "p_mes"?: string }; Returns: Json
                           }
          }
          Enums: {
  }
}`;

describe("extrator de .rpc", () => {
  it("acha chamadas diretas com o esquema e as feitas por embrulho com `funcao`", () => {
    expect(embrulhosDeRpc(CODIGO).sort()).toEqual(["escrever", "ler"]);
    const usos = usosDoApp([{ caminho: "lib/dados/x.ts", texto: CODIGO }]).map(
      (u) => `${u.esquema}.${u.funcao}`,
    );
    expect(usos).toEqual([
      "config.perfil_atual",
      "nucleo.marcar_escala",
      "nucleo.operacoes_do_mes",
      "nucleo.pessoas_da_lista",
    ]);
  });
  it("não confunde o nome da própria função com um uso", () => {
    expect(usosDoApp([{ caminho: "a.ts", texto: CODIGO }]).some((u) => u.funcao === "funcao")).toBe(
      false,
    );
  });
});

describe("tipos e identidade do banco", () => {
  it("lê os argumentos por esquema", () => {
    const t = funcoesDosTipos(TIPOS);
    expect(t.get("nucleo.pessoas_da_lista")).toEqual(["p_pessoa", "p_tam"]);
    expect(t.get("config.perfil_atual")).toEqual([]);
  });
  it("lê os nomes dos argumentos do pg_get_function_identity_arguments", () => {
    expect(nomesDosArgumentos("p_mes date, p_tam integer")).toEqual(["p_mes", "p_tam"]);
    expect(nomesDosArgumentos("")).toEqual([]);
  });
});

describe("comparador", () => {
  const uso = [{ esquema: "nucleo", funcao: "f", arquivo: "x" }];
  const tipos = new Map([["nucleo.f", ["p_a"]]]);
  const banco = (f: FuncaoDoBanco[] | undefined) => new Map(f ? [["nucleo.f", f]] : []);
  it("função presente com a mesma assinatura e permissão: sem problema", () => {
    expect(compararParidade(uso, tipos, banco([{ argumentos: ["p_a"], executa: true }]))).toEqual(
      [],
    );
  });
  it("ausente no banco", () => {
    expect(compararParidade(uso, tipos, banco(undefined))[0]?.motivo).toBe("ausente_no_banco");
  });
  it("assinatura diferente", () => {
    expect(
      compararParidade(uso, tipos, banco([{ argumentos: ["p_b"], executa: true }]))[0]?.motivo,
    ).toBe("assinatura_diferente");
  });
  it("sem permissão para authenticated", () => {
    expect(
      compararParidade(uso, tipos, banco([{ argumentos: ["p_a"], executa: false }]))[0]?.motivo,
    ).toBe("sem_permissao");
  });
  it("fora dos tipos", () => {
    expect(compararParidade(uso, new Map())[0]?.motivo).toBe("ausente_dos_tipos");
  });
  it("o relatório diz como resolver e só traz nomes", () => {
    const txt = relatorioDeParidade(compararParidade(uso, tipos, banco(undefined)), 1);
    expect(txt).toContain("nucleo.f: ausente no banco");
    expect(txt).toContain("aplique as migrations");
    expect(txt).toContain("pnpm exec supabase migration up --local");
  });
});

describe("estático: toda função que o app chama está nos tipos do banco", () => {
  it("o código real contra lib/dados/tipos-do-banco.ts", () => {
    const usos = usosDoApp(arquivosDoApp(process.cwd()));
    expect(usos.length).toBeGreaterThan(10);
    const tipos = funcoesDosTipos(readFileSync("lib/dados/tipos-do-banco.ts", "utf8"));
    const faltam = compararParidade(usos, tipos).map((p) => `${p.esquema}.${p.funcao}`);
    expect(faltam).toEqual([]);
  });
});

describe("leitura do banco", () => {
  it("lê esquema, nome, argumentos e permissão de cada linha do psql", () => {
    const m = lerDoBanco("nucleo|f|p_a date, p_b integer|true\nconfig|g||false\n");
    expect(m.get("nucleo.f")).toEqual([{ argumentos: ["p_a", "p_b"], executa: true }]);
    expect(m.get("config.g")).toEqual([{ argumentos: [], executa: false }]);
  });
  it("o contêiner segue o project_id do config.toml", () => {
    expect(conteinerDoBanco('project_id = "Meu_Proj"\n')).toBe("supabase_db_Meu_Proj");
  });
});
