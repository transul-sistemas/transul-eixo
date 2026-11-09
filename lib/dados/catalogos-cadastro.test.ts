import { describe, expect, it, vi } from "vitest";
import {
  arquivarItem,
  type ClienteDeCadastros,
  type ConsultaEncadeavel,
  editarItem,
  incluirItem,
  listarCatalogo,
  padraoDeBusca,
} from "./catalogos-cadastro";
import { catalogoPorId } from "./catalogos-definicoes";

const ID = "11111111-1111-4111-8111-111111111111";

/** Um simulado do cliente: registra o que a consulta pediu e devolve as linhas combinadas. */
function simulado(respostas: Record<string, { data: unknown; error?: unknown; count?: number }>) {
  const chamadas: string[] = [];
  const consulta = (tabela: string): ConsultaEncadeavel => {
    const c: ConsultaEncadeavel = {
      is: (col, v) => (chamadas.push(`is ${col} ${v}`), c),
      ilike: (col, p) => (chamadas.push(`ilike ${col} ${p}`), c),
      in: (col, v) => (chamadas.push(`in ${col} ${v.join(",")}`), c),
      order: (col) => (chamadas.push(`order ${col}`), c),
      range: (de, ate) => (chamadas.push(`range ${de}-${ate}`), c),
      then: (aoResolver, aoRejeitar) =>
        Promise.resolve({ error: null, ...respostas[tabela]! } as never).then(
          aoResolver,
          aoRejeitar,
        ),
    };
    return c;
  };
  const insert = vi.fn((linha: Record<string, unknown>) => ({
    select: () => ({
      single: async () =>
        respostas.insert ?? { data: { id: ID, nome: linha.nome, versao: 1 }, error: null },
    }),
  }));
  const eqs: string[] = [];
  const update = vi.fn((valores: Record<string, unknown>) => {
    void valores;
    const ultimo = {
      select: () => ({
        maybeSingle: async () =>
          respostas.update ?? { data: { id: ID, nome: "x", versao: 2 }, error: null },
      }),
    };
    return {
      eq: (c: string, v: string | number) => (
        eqs.push(`${c}=${v}`),
        { eq: (c2: string, v2: string | number) => (eqs.push(`${c2}=${v2}`), ultimo) }
      ),
    };
  });
  const cliente = {
    schema: () => ({
      from: (tabela: string) => ({ select: () => consulta(tabela), insert, update }),
    }),
  } as unknown as ClienteDeCadastros;
  return { cliente, chamadas, insert, update, eqs };
}

describe("listar catálogo", () => {
  it("lista sem arquivados, pagina, desempata pela chave e conta o total", async () => {
    const s = simulado({
      marca: {
        data: [
          {
            id: "a",
            nome: "Volvo",
            versao: 2,
            criado_em: "2026-11-01T10:00:00-03:00",
            excluido_em: null,
          },
        ],
        count: 120,
      },
    });
    const r = await listarCatalogo(s.cliente, catalogoPorId("marca"), {
      busca: "",
      pagina: 2,
      arquivados: false,
    });
    expect(s.chamadas).toContain("is excluido_em null");
    expect(s.chamadas).toContain("order nome");
    expect(s.chamadas).toContain("order id");
    expect(s.chamadas).toContain("range 50-99");
    expect(r.total).toBe(120);
    expect(r.paginas).toBe(3);
    expect(r.linhas[0]).toMatchObject({ id: "a", versao: 2, arquivado: false });
    expect(r.linhas[0]!.celulas.nome).toBe("Volvo");
    expect(r.linhas[0]!.celulas.criado_em).toBe("01/11/2026");
  });

  it("com arquivados não filtra e marca a linha; a busca escapa curingas", async () => {
    const s = simulado({
      filial: {
        data: [
          {
            id: "f",
            nome: "Matriz",
            versao: 1,
            excluido_em: "2026-11-02",
            motivo_da_exclusao: "Fechou",
          },
        ],
        count: 1,
      },
    });
    const r = await listarCatalogo(s.cliente, catalogoPorId("filial"), {
      busca: "100%",
      pagina: 1,
      arquivados: true,
    });
    expect(s.chamadas.some((c) => c.startsWith("is "))).toBe(false);
    expect(s.chamadas).toContain("ilike nome %100\\%%");
    expect(r.linhas[0]).toMatchObject({ arquivado: true, motivo: "Fechou" });
  });

  it("resolve o nome da referência (marca do modelo) em uma consulta só", async () => {
    const s = simulado({
      modelo: {
        data: [
          { id: "m1", nome: "FH 540", marca_id: "ma1", eixos: 3, versao: 1 },
          { id: "m2", nome: "FH 460", marca_id: "ma1", eixos: null, versao: 1 },
        ],
        count: 2,
      },
      marca: { data: [{ id: "ma1", nome: "Volvo" }] },
    });
    const r = await listarCatalogo(s.cliente, catalogoPorId("modelo"), {
      busca: "",
      pagina: 1,
      arquivados: false,
    });
    expect(s.chamadas.filter((c) => c.startsWith("in "))).toEqual(["in id ma1"]);
    expect(r.linhas.map((l) => l.celulas.marca)).toEqual(["Volvo", "Volvo"]);
    expect(r.linhas[1]!.celulas.eixos).toBe("");
  });

  it("a chave da nomenclatura junta carroceria e configuração; um erro do banco vira exceção", async () => {
    const ok = simulado({
      nomenclatura_de_conjunto: {
        data: [{ carroceria_id: "c1", configuracao: "bi", nome: "Bitrem" }],
        count: 1,
      },
      carroceria: { data: [{ id: "c1", nome: "Graneleira" }] },
    });
    const r = await listarCatalogo(ok.cliente, catalogoPorId("nomenclatura"), {
      busca: "",
      pagina: 1,
      arquivados: false,
    });
    expect(r.linhas[0]!.chave).toBe("c1|bi");
    const ruim = simulado({ marca: { data: null, error: { message: "sem acesso" } } });
    await expect(
      listarCatalogo(ruim.cliente, catalogoPorId("marca"), {
        busca: "",
        pagina: 1,
        arquivados: false,
      }),
    ).rejects.toThrow(/sem acesso/);
  });

  it("padrão de busca escapa % _ e barra", () => {
    expect(padraoDeBusca(" a_b ")).toBe("%a\\_b%");
  });

  it("só os catálogos do Eixo se editam; CR e régua são leitura", () => {
    expect(catalogoPorId("cr").editavel).toBeNull();
    expect(catalogoPorId("status").editavel).toBeNull();
    expect(catalogoPorId("operacao").editavel).toBe("operacao");
  });
});

describe("gravar item", () => {
  it("inclui e devolve a linha", async () => {
    const s = simulado({});
    const r = await incluirItem(s.cliente, { catalogo: "marca", nome: "Scania" });
    expect(r).toEqual({ ok: true, linha: { id: ID, nome: "Scania", versao: 1 } });
    expect(s.insert).toHaveBeenCalledWith({ nome: "Scania" });
  });

  it("nome repetido vira erro no campo", async () => {
    const s = simulado({ insert: { data: null, error: { message: "dup", code: "23505" } } });
    const r = await incluirItem(s.cliente, { catalogo: "marca", nome: "Scania" });
    expect(r).toMatchObject({
      ok: false,
      erro: {
        codigo: "entrada_invalida",
        campos: { nome: [expect.stringContaining("Já existe")] },
      },
    });
  });

  it("sem permissão do banco devolve sem_permissao", async () => {
    const s = simulado({ insert: { data: null, error: { message: "negado", code: "42501" } } });
    const r = await incluirItem(s.cliente, { catalogo: "filial", nome: "Norte" });
    expect(r).toMatchObject({ ok: false, erro: { codigo: "sem_permissao" } });
  });

  it("editar confere a versão que a pessoa viu; sem linha é conflito", async () => {
    const s = simulado({});
    const ok = await editarItem(s.cliente, {
      catalogo: "carroceria",
      nome: "Sider",
      id: ID,
      versao: 3,
    });
    expect(ok.ok).toBe(true);
    expect(s.eqs).toEqual([`id=${ID}`, "versao=3"]);
    const velho = simulado({ update: { data: null, error: null } });
    const r = await editarItem(velho.cliente, {
      catalogo: "carroceria",
      nome: "Sider",
      id: ID,
      versao: 1,
    });
    expect(r).toMatchObject({ ok: false, erro: { codigo: "conflito" } });
  });

  it("arquivar grava quem, quando e o motivo (exclusão lógica)", async () => {
    const s = simulado({});
    await arquivarItem(
      s.cliente,
      { catalogo: "operacao", id: ID, versao: 1, motivo: "Operação encerrada" },
      "pessoa-1",
      "2026-11-09T10:00:00-03:00",
    );
    expect(s.update).toHaveBeenCalledWith({
      excluido_em: "2026-11-09T10:00:00-03:00",
      excluido_por: "pessoa-1",
      motivo_da_exclusao: "Operação encerrada",
    });
  });
});
