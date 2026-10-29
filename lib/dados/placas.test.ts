import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { grupoDaSigla, SIGLAS_DE_BAIXA } from "@/lib/dominio/status";
import { placasDeExemplo } from "@/lib/exemplo/placas";
import type { ConsultaDeTabela } from "@/lib/navegacao/tabela";
import { CAMPOS_ORDENAVEIS_DE_PLACAS, listarPlacas, type PaginaDePlacas } from "./placas";

const HOJE = "2026-10-29";
const TODAS = placasDeExemplo(HOJE);
const SEM_BAIXADAS = TODAS.filter((p) => !SIGLAS_DE_BAIXA.includes(p.sigla));

const consulta = (parcial: Partial<ConsultaDeTabela> = {}): ConsultaDeTabela => ({
  busca: "",
  chips: [],
  siglas: [],
  baixadas: false,
  ordem: { campo: "placa", sentido: "asc" },
  pagina: 1,
  tam: 25,
  ...parcial,
});
const listar = (parcial: Partial<ConsultaDeTabela> = {}) => listarPlacas(consulta(parcial), HOJE);

async function todasAsLinhas(parcial: Partial<ConsultaDeTabela>, tam: number) {
  const primeira = await listar({ ...parcial, tam, pagina: 1 });
  const linhas = [...primeira.linhas];
  for (let pagina = 2; pagina <= primeira.paginas; pagina++) {
    linhas.push(...(await listar({ ...parcial, tam, pagina })).linhas);
  }
  return { linhas, total: primeira.total };
}

beforeEach(() => vi.stubEnv("EIXO_DADOS", "exemplo"));
afterEach(() => vi.unstubAllEnvs());

describe("listarPlacas: o que entra", () => {
  it("por padrão deixa de fora as baixadas (VND e SUC)", async () => {
    const pagina = await listar();
    expect(pagina.total).toBe(SEM_BAIXADAS.length);
    expect(pagina.linhas.length).toBe(25);
    expect(pagina.linhas.every((l) => l.sigla !== "VND" && l.sigla !== "SUC")).toBe(true);
  });
  it("com 'inclui baixadas' traz todas", async () => {
    expect((await listar({ baixadas: true })).total).toBe(TODAS.length);
  });
  it("a linha traz a sigla, o nome, o grupo, os dias na situação e os alertas", async () => {
    const [linha] = (await listar({ busca: "AAA0A04" })).linhas;
    expect(linha?.placa).toBe("AAA0A04");
    expect(linha?.nomeDaSituacao.length).toBeGreaterThan(0);
    expect(linha?.grupo).toBe(grupoDaSigla(linha!.sigla));
    expect(linha?.alertas.map((a) => a.codigo)).toContain("modelo-a-definir");
    const solto = (await listar({ busca: "AAA0C17", baixadas: true })).linhas[0];
    expect(solto?.diasNoStatus).toBe(35);
  });
  it("o conjunto mostra as placas, não os ids", async () => {
    const todas = (await todasAsLinhas({}, 100)).linhas;
    const cavalo = todas.find((l) => l.conjunto.implementos.length > 0);
    expect(cavalo?.conjunto.implementos.every((p) => /^AAA\d[A-Z]\d{2}$/.test(p))).toBe(true);
    const implemento = todas.find((l) => l.tipo === "implemento" && l.conjunto.cavalo);
    expect(implemento?.conjunto.cavalo).toMatch(/^AAA\d[A-Z]\d{2}$/);
  });
});

describe("listarPlacas: busca", () => {
  it("acha a mesma placa digitada de jeitos diferentes", async () => {
    for (const busca of ["AAA0A00", "aaa0a00", "aaa-0a00", "  AAA0A00  "]) {
      const pagina = await listar({ busca });
      expect(pagina.linhas[0]?.placa, busca).toBe("AAA0A00");
      expect(pagina.total, busca).toBe(1);
    }
  });
  it("acha por trecho da placa, do modelo e do gestor", async () => {
    expect((await listar({ busca: "AAA0A0", baixadas: true })).total).toBeGreaterThanOrEqual(10);
    expect((await listar({ busca: "a definir" })).linhas.map((l) => l.placa)).toContain("AAA0A04");
    expect((await listar({ busca: "gestor exemplo 3" })).total).toBeGreaterThan(0);
  });
  it("não acha a diferença de acento nem de caixa", async () => {
    const com = (await listar({ busca: "operação exemplo 1" })).total;
    expect((await listar({ busca: "OPERACAO EXEMPLO 1" })).total).toBe(com);
  });
  it.each(["'", "%", "_", "🚚", '"; drop table x; --', "\\", "(", "[a-"])(
    "texto estranho %j não quebra",
    async (busca) => {
      const pagina = await listar({ busca });
      expect(Number.isInteger(pagina.total)).toBe(true);
      expect(pagina.paginas).toBeGreaterThanOrEqual(1);
    },
  );
  it("só espaços é o mesmo que sem busca", async () => {
    expect((await listar({ busca: "     " })).total).toBe((await listar()).total);
  });
  it("sem resultado: total 0, uma página, nenhuma linha", async () => {
    const pagina = await listar({ busca: "zzzzzzzz" });
    expect(pagina).toMatchObject({ total: 0, pagina: 1, paginas: 1, linhas: [] });
  });
});

describe("listarPlacas: chips e siglas", () => {
  it("dois chips do mesmo grupo valem OU", async () => {
    const pagina = await listar({ chips: ["patio", "atencao"], tam: 100 });
    const esperado = SEM_BAIXADAS.filter((p) =>
      ["patio", "atencao"].includes(grupoDaSigla(p.sigla)),
    );
    expect(pagina.total).toBe(esperado.length);
  });
  it("chips de grupos diferentes valem E", async () => {
    const pagina = await listar({ chips: ["atencao", "cavalo"], tam: 100 });
    const esperado = SEM_BAIXADAS.filter(
      (p) => grupoDaSigla(p.sigla) === "atencao" && p.tipo === "cavalo",
    );
    expect(pagina.total).toBe(esperado.length);
  });
  it("a sigla exata combina em E com o chip", async () => {
    const soSigla = await listar({ siglas: ["PÁT"], tam: 100 });
    expect(soSigla.linhas.every((l) => l.sigla === "PÁT")).toBe(true);
    const foraEPat = await listar({ siglas: ["PÁT"], chips: ["fora"] });
    expect(foraEPat.total).toBe(0);
  });
  it("o chip Fora sem 'inclui baixadas' não traz VND nem SUC", async () => {
    const fora = await listar({ chips: ["fora"], tam: 100 });
    expect(fora.linhas.every((l) => l.sigla !== "VND" && l.sigla !== "SUC")).toBe(true);
    const comBaixadas = await listar({ chips: ["fora"], baixadas: true, tam: 100 });
    expect(comBaixadas.total).toBeGreaterThan(fora.total);
  });
});

describe("listarPlacas: contagens dos chips", () => {
  it("sem filtro, cada chip conta o que tem, e a soma dos de status é o total", async () => {
    const { contagens, total } = await listar();
    const doGrupo = (g: string) => SEM_BAIXADAS.filter((p) => grupoDaSigla(p.sigla) === g).length;
    for (const g of ["em-atividade", "atencao", "impedida", "patio", "fora"]) {
      expect(contagens[g], g).toBe(doGrupo(g));
    }
    const soma = ["em-atividade", "atencao", "impedida", "patio", "fora"].reduce(
      (acc, g) => acc + (contagens[g] ?? 0),
      0,
    );
    expect(soma).toBe(total);
  });
  it("a contagem de um grupo ignora a seleção do próprio grupo", async () => {
    const livre = (await listar()).contagens;
    const comPatio = (await listar({ chips: ["patio"] })).contagens;
    for (const g of ["em-atividade", "atencao", "impedida", "patio", "fora"]) {
      expect(comPatio[g], g).toBe(livre[g]);
    }
  });
  it("a contagem de um grupo respeita a seleção dos outros grupos", async () => {
    const cavalos = (await listar({ chips: ["cavalo"] })).contagens;
    const esperado = SEM_BAIXADAS.filter(
      (p) => p.tipo === "cavalo" && grupoDaSigla(p.sigla) === "em-atividade",
    ).length;
    expect(cavalos["em-atividade"]).toBe(esperado);
    // e a contagem do próprio grupo de tipo continua a de todos os tipos
    const livre = (await listar()).contagens;
    expect(cavalos["cavalo"]).toBe(livre["cavalo"]);
    expect(cavalos["implemento"]).toBe(livre["implemento"]);
  });
  it("a contagem respeita a busca e 'inclui baixadas'", async () => {
    const busca = (await listar({ busca: "AAA0A0" })).contagens;
    const esperado = SEM_BAIXADAS.filter(
      (p) => p.placa.startsWith("AAA0A0") && grupoDaSigla(p.sigla) === "patio",
    ).length;
    expect(busca["patio"]).toBe(esperado);
    const comBaixadas = (await listar({ baixadas: true })).contagens;
    const semBaixadas = (await listar()).contagens;
    expect(comBaixadas["fora"]).toBeGreaterThan(semBaixadas["fora"] as number);
  });
  it("chip sem resultado tem contagem 0 e continua no objeto", async () => {
    const { contagens } = await listar({ chips: ["cavalo"], busca: "AAA0A00" });
    for (const id of ["em-atividade", "atencao", "impedida", "patio", "fora", "equipamento"]) {
      expect(contagens, id).toHaveProperty(id);
    }
    expect(contagens["equipamento"]).toBe(0);
  });
});

describe("listarPlacas: ordem com desempate pela chave (armadilha 1)", () => {
  const casos = CAMPOS_ORDENAVEIS_DE_PLACAS.flatMap((campo) =>
    (["asc", "desc"] as const).map((sentido) => [campo, sentido] as const),
  );
  it.each(casos)(
    "ordenar por %s %s: percorrer as páginas não repete nem perde linha",
    async (campo, sentido) => {
      const ordem = { campo, sentido };
      const miudo = await todasAsLinhas({ ordem, baixadas: true }, 7);
      const grande = await todasAsLinhas({ ordem, baixadas: true }, 100);
      const ids = miudo.linhas.map((l) => l.id);
      expect(ids.length).toBe(TODAS.length);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toEqual(grande.linhas.map((l) => l.id));
    },
  );
  it("com empate, o id decide, sempre crescente", async () => {
    const { linhas } = await todasAsLinhas({ ordem: { campo: "tipo", sentido: "desc" } }, 100);
    for (let i = 1; i < linhas.length; i++) {
      const a = linhas[i - 1]!;
      const b = linhas[i]!;
      if (a.tipo === b.tipo) expect(a.id < b.id).toBe(true);
    }
  });
  it("valores vazios ficam sempre no fim, nas duas direções", async () => {
    for (const sentido of ["asc", "desc"] as const) {
      const { linhas } = await todasAsLinhas({ ordem: { campo: "motorista", sentido } }, 100);
      const primeiroNulo = linhas.findIndex((l) => l.motorista === null);
      expect(primeiroNulo).toBeGreaterThan(0);
      expect(
        linhas.slice(primeiroNulo).every((l) => l.motorista === null),
        sentido,
      ).toBe(true);
    }
  });
  it("ordenar por dias na situação é numérico", async () => {
    const { linhas } = await todasAsLinhas({ ordem: { campo: "dias", sentido: "desc" } }, 100);
    for (let i = 1; i < linhas.length; i++) {
      expect(linhas[i - 1]!.diasNoStatus).toBeGreaterThanOrEqual(linhas[i]!.diasNoStatus);
    }
  });
  it("campo desconhecido não quebra: usa a placa", async () => {
    const pagina = await listar({ ordem: { campo: "nao-existe", sentido: "asc" } });
    expect(pagina.linhas[0]?.placa).toBe("AAA0A00");
  });
});

describe("listarPlacas: página", () => {
  it("segunda página começa onde a primeira terminou", async () => {
    const a = await listar({ tam: 10, pagina: 1 });
    const b = await listar({ tam: 10, pagina: 2 });
    expect(a.linhas.at(-1)!.placa < b.linhas[0]!.placa).toBe(true);
    expect(b.pagina).toBe(2);
  });
  it("página acima do fim devolve a última", async () => {
    const primeira = await listar({ tam: 10 });
    const pagina = await listar({ tam: 10, pagina: 9999 });
    expect(pagina.pagina).toBe(primeira.paginas);
    expect(pagina.linhas.length).toBeGreaterThan(0);
  });
  it("tam acima de 100 nunca devolve mais de 100 linhas", async () => {
    const pagina = await listar({ tam: 500, baixadas: true });
    expect(pagina.tam).toBe(100);
    expect(pagina.linhas.length).toBe(100);
  });
  it("tam inválido (0, negativo, fração) usa o padrão de 25", async () => {
    for (const tam of [0, -5, 2.5, Number.NaN]) {
      expect((await listar({ tam })).linhas.length, String(tam)).toBe(25);
    }
  });
});

describe("listarPlacas: fonte", () => {
  it("sem EIXO_DADOS=exemplo recusa rodar", async () => {
    vi.stubEnv("EIXO_DADOS", "");
    await expect(listar()).rejects.toThrow("A fonte de exemplo só roda com EIXO_DADOS=exemplo");
  });
  it("simula falha e lentidão só para testar os estados da tela", async () => {
    await expect(listarPlacas(consulta(), HOJE, { simulacao: { falha: true } })).rejects.toThrow(
      "Falha simulada",
    );
    const antes = Date.now();
    await listarPlacas(consulta(), HOJE, { simulacao: { lentoMs: 120 } });
    expect(Date.now() - antes).toBeGreaterThanOrEqual(110);
  });
  it("lento e falha não têm efeito fora da fonte de exemplo: a fonte recusa antes de obedecer", async () => {
    vi.stubEnv("EIXO_DADOS", "");
    const antes = Date.now();
    await expect(
      listarPlacas(consulta(), HOJE, { simulacao: { falha: true, lentoMs: 800 } }),
    ).rejects.toThrow("A fonte de exemplo só roda com EIXO_DADOS=exemplo");
    expect(Date.now() - antes).toBeLessThan(400);
  });
  it("devolve o formato da página", async () => {
    const pagina: PaginaDePlacas = await listar();
    expect(Object.keys(pagina).sort()).toEqual(
      ["contagens", "linhas", "pagina", "paginas", "tam", "total"].sort(),
    );
  });
});
