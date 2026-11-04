import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { segmentosDaLinhaDoTempo } from "@/lib/dominio/linha-do-tempo";
import { SIGLAS_DE_BAIXA } from "@/lib/dominio/status";
import { eventosDeExemplo } from "@/lib/exemplo/eventos";
import { placasDeExemplo } from "@/lib/exemplo/placas";
import { listarPlacas, obterFicha, obterPlaca } from "./placas";

// Sem EIXO_DADOS=exemplo a fonte é o banco (3.9a): aqui, um cliente que sempre falha.
vi.mock("@/lib/supabase/servidor", () => ({
  criarClienteDoServidor: async () => ({
    schema: () => ({ rpc: async () => ({ data: null, error: { message: "sem banco no teste" } }) }),
  }),
}));

const HOJE = "2026-10-29";
const TODAS = placasDeExemplo(HOJE);

beforeEach(() => vi.stubEnv("EIXO_DADOS", "exemplo"));
afterEach(() => vi.unstubAllEnvs());

describe("obterFicha: a ficha da placa (detalhe e história)", () => {
  it("traz o detalhe do painel e os eventos, com o último na situação atual", async () => {
    const ficha = await obterFicha("AAA0A04", HOJE);
    const detalhe = await obterPlaca("AAA0A04", HOJE);
    const exemplo = TODAS.find((p) => p.placa === "AAA0A04")!;
    expect(ficha).not.toBeNull();
    expect(ficha).toMatchObject(detalhe!);
    expect(ficha?.eventos).toEqual(eventosDeExemplo(exemplo));
    expect(ficha?.eventos.at(-1)).toEqual({ sigla: ficha?.sigla, em: ficha?.desde });
  });

  it.each(["aaa-0a04", " aaa0a04 ", "AAA 0A04"])("normaliza a placa escrita como %j", async (e) => {
    expect((await obterFicha(e, HOJE))?.placa).toBe("AAA0A04");
  });

  it("placa que não existe, vazia ou com HTML devolve nulo, sem erro", async () => {
    expect(await obterFicha("ZZZ9Z99", HOJE)).toBeNull();
    expect(await obterFicha("", HOJE)).toBeNull();
    expect(await obterFicha("<script>", HOJE)).toBeNull();
  });

  it("acha a placa baixada, com a baixa no fim da história", async () => {
    const baixada = TODAS.find((p) => SIGLAS_DE_BAIXA.includes(p.sigla))!;
    const ficha = await obterFicha(baixada.placa, HOJE);
    expect(ficha?.placa).toBe(baixada.placa);
    expect(SIGLAS_DE_BAIXA).toContain(ficha?.eventos.at(-1)?.sigla);
  });

  it("os eventos alimentam a linha do tempo: as faixas somam a janela inteira", async () => {
    const ficha = await obterFicha("AAA0A00", HOJE);
    const janela = { de: "2026-09-29T00:00", ate: `${HOJE}T12:00` };
    const faixas = segmentosDaLinhaDoTempo(ficha!.eventos, janela, `${HOJE}T12:00`);
    expect(faixas.reduce((t, f) => t + f.minutos, 0)).toBe(30 * 1440 + 12 * 60);
    expect(faixas.at(-1)?.sigla).toBe(ficha?.sigla);
  });

  it("sem EIXO_DADOS=exemplo vai ao banco (e o erro dele chega)", async () => {
    vi.stubEnv("EIXO_DADOS", "");
    await expect(obterFicha("AAA0A04", HOJE)).rejects.toThrow(/sem banco no teste/);
  });

  it("falha (simulação da tela) falha a ficha; falhaNoPainel não, porque é só do painel", async () => {
    await expect(obterFicha("AAA0A04", HOJE, { simulacao: { falha: true } })).rejects.toThrow(
      /Falha simulada/,
    );
    expect((await obterFicha("AAA0A04", HOJE, { simulacao: { falhaNoPainel: true } }))?.placa).toBe(
      "AAA0A04",
    );
  });

  it("lento vale para a ficha", async () => {
    const inicio = Date.now();
    await obterFicha("AAA0A04", HOJE, { simulacao: { lentoMs: 60 } });
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(50);
  });

  it("a lista continua igual: a ficha não mexe em listarPlacas", async () => {
    const pagina = await listarPlacas(
      {
        busca: "",
        chips: [],
        siglas: [],
        baixadas: false,
        ordem: { campo: "placa", sentido: "asc" },
        pagina: 1,
        tam: 25,
      },
      HOJE,
    );
    expect(pagina.linhas).toHaveLength(25);
  });
});
