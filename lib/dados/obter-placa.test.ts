import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIGLAS_DE_BAIXA } from "@/lib/dominio/status";
import { placasDeExemplo } from "@/lib/exemplo/placas";
import type { ConsultaDeTabela } from "@/lib/navegacao/tabela";
import { dadosDoPainel, listarPlacas, obterPlaca } from "./placas";

const HOJE = "2026-10-29";
const TODAS = placasDeExemplo(HOJE);

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

beforeEach(() => vi.stubEnv("EIXO_DADOS", "exemplo"));
afterEach(() => vi.unstubAllEnvs());

describe("obterPlaca: o detalhe de uma placa para o painel de espiar", () => {
  it("devolve os mesmos campos da linha da lista, mais ano, RENAVAM, desde e CRs", async () => {
    const detalhe = await obterPlaca("AAA0A04", HOJE);
    const [linha] = (await listarPlacas(consulta({ busca: "AAA0A04" }), HOJE)).linhas;
    const exemplo = TODAS.find((p) => p.placa === "AAA0A04")!;
    expect(detalhe).not.toBeNull();
    expect(detalhe).toMatchObject(linha!);
    expect(detalhe?.ano).toBe(exemplo.ano);
    expect(detalhe?.renavam).toBe(exemplo.renavam);
    expect(detalhe?.desde).toBe(exemplo.desde);
    expect(detalhe?.crs).toEqual(exemplo.crs);
    expect(detalhe?.alertas.map((a) => a.codigo)).toContain("modelo-a-definir");
  });

  it.each(["aaa-0a04", " aaa0a04 ", "AAA 0A04", "aaa0a04"])(
    "acha a mesma placa escrita como %j",
    async (escrita) => {
      expect((await obterPlaca(escrita, HOJE))?.placa).toBe("AAA0A04");
    },
  );

  it("placa que não existe devolve nulo, sem erro", async () => {
    expect(await obterPlaca("ZZZ9Z99", HOJE)).toBeNull();
    expect(await obterPlaca("", HOJE)).toBeNull();
    expect(await obterPlaca("<script>", HOJE)).toBeNull();
  });

  it("acha a placa baixada (VND ou SUC): a lista as esconde, o painel não", async () => {
    const baixada = TODAS.find((p) => SIGLAS_DE_BAIXA.includes(p.sigla))!;
    const escondida = (await listarPlacas(consulta({ busca: baixada.placa }), HOJE)).linhas;
    expect(escondida).toHaveLength(0);
    const detalhe = await obterPlaca(baixada.placa, HOJE);
    expect(detalhe?.placa).toBe(baixada.placa);
    expect(SIGLAS_DE_BAIXA).toContain(detalhe?.sigla);
  });

  it("o cavalo com dois CRs vigentes traz os dois", async () => {
    const detalhe = await obterPlaca("AAA0A10", HOJE);
    expect(detalhe?.crs).toHaveLength(2);
    expect(detalhe?.crsVigentes.map((cr) => cr.codigo)).toEqual(["CR-1001", "CR-1002"]);
    expect(detalhe?.alertas.map((a) => a.codigo)).toContain("cr-sobreposto");
  });

  it("os CRs vigentes são só os de hoje: o que terminou fica no histórico", async () => {
    const historico = await obterPlaca("AAA0A14", HOJE);
    expect(historico?.crs).toHaveLength(2);
    expect(historico?.crsVigentes.map((cr) => cr.codigo)).toEqual(["CR-1002"]);
    // Troca de CR hoje: o que termina hoje já não vale, o que começa hoje vale ([início, fim)).
    const troca = await obterPlaca("AAA0A19", HOJE);
    expect(troca?.crsVigentes.map((cr) => cr.codigo)).toEqual(["CR-1002"]);
  });

  it("placa sem operação e sem CR devolve lista de CRs vazia", async () => {
    const detalhe = await obterPlaca("AAA0A28", HOJE);
    expect(detalhe?.crs).toEqual([]);
    expect(detalhe?.crsVigentes).toEqual([]);
    expect(detalhe?.operacao).toBeNull();
  });

  it("sem EIXO_DADOS=exemplo recusa, com a mesma mensagem da lista", async () => {
    vi.stubEnv("EIXO_DADOS", "");
    await expect(obterPlaca("AAA0A04", HOJE)).rejects.toThrow(/EIXO_DADOS=exemplo/);
  });

  it("falhaNoPainel falha só o detalhe, não a lista", async () => {
    const simulacao = { falhaNoPainel: true };
    await expect(obterPlaca("AAA0A04", HOJE, { simulacao })).rejects.toThrow(/Falha simulada/);
    const pagina = await listarPlacas(consulta(), HOJE, { simulacao });
    expect(pagina.linhas.length).toBeGreaterThan(0);
  });

  it("falha (da lista) não derruba o detalhe: cada parte tem a sua simulação", async () => {
    expect((await obterPlaca("AAA0A04", HOJE, { simulacao: { falha: true } }))?.placa).toBe(
      "AAA0A04",
    );
  });

  it("lento vale para o detalhe", async () => {
    const inicio = Date.now();
    await obterPlaca("AAA0A04", HOJE, { simulacao: { lentoMs: 60 } });
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(50);
  });
});

describe("dadosDoPainel: o que a página entrega ao painel, sem nunca derrubar a lista", () => {
  it("sem placa na URL não há painel", async () => {
    expect(await dadosDoPainel(null, HOJE)).toBeNull();
  });

  it("placa que existe vem com o detalhe", async () => {
    const dados = await dadosDoPainel("AAA0A04", HOJE);
    expect(dados).toMatchObject({ placa: "AAA0A04", situacao: "ok" });
    expect(dados?.situacao === "ok" && dados.detalhe.placa).toBe("AAA0A04");
  });

  it("placa bem escrita que não existe vem como não encontrada", async () => {
    expect(await dadosDoPainel("ZZZ9Z99", HOJE)).toEqual({
      placa: "ZZZ9Z99",
      situacao: "nao-encontrada",
    });
  });

  it("a falha da fonte vira erro do painel, sem lançar (a lista segue de pé)", async () => {
    const dados = await dadosDoPainel("AAA0A04", HOJE, { simulacao: { falhaNoPainel: true } });
    expect(dados).toEqual({ placa: "AAA0A04", situacao: "erro" });
  });

  it("a falha é registrada (não some em silêncio) para quem der suporte achar", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    await dadosDoPainel("AAA0A04", HOJE, { simulacao: { falhaNoPainel: true } });
    expect(registro).toHaveBeenCalledTimes(1);
    expect(String(registro.mock.calls[0]?.[0])).toContain("AAA0A04");
    registro.mockRestore();
  });

  it("sem EIXO_DADOS=exemplo também vira erro do painel, não exceção", async () => {
    vi.stubEnv("EIXO_DADOS", "");
    expect(await dadosDoPainel("AAA0A04", HOJE)).toEqual({ placa: "AAA0A04", situacao: "erro" });
  });
});
