import { describe, expect, it, vi } from "vitest";
import { criarArmazem } from "@/lib/exemplo/armazem";
import { placasDeExemplo } from "@/lib/exemplo/placas";
import { chaveDaParte } from "@/lib/wizard/chave-de-envio";
import { executarEngatarVarios } from "./escrita";
import type { FonteDeEscrita } from "./fonte";
import { escritaDoArmazem } from "./fonte-de-exemplo";

// Engatar vários implementos de uma vez (aba Soltas e ficha do cavalo): uma chamada a nucleo.engatar por
// peça, na ordem, com a posição seguinte à última ocupada. Uma falha para o lote e diz "X de Y".

const HOJE = "2026-10-31";
const AGORA = "2026-10-31T09:30";
const CHAVE = "11111111-1111-4111-8111-111111111111";

const base = placasDeExemplo(HOJE);

function contexto(fonte?: FonteDeEscrita) {
  const armazem = criarArmazem({ placasBase: base });
  return { fonte: fonte ?? escritaDoArmazem(armazem), agora: AGORA, hoje: HOJE, gestorId: "g" };
}

describe("chaveDaParte: uma chave por peça, derivada e estável", () => {
  it("a parte 0 é a própria chave; as outras mudam e continuam UUID", () => {
    expect(chaveDaParte(CHAVE, 0)).toBe(CHAVE);
    const um = chaveDaParte(CHAVE, 1);
    expect(um).not.toBe(CHAVE);
    expect(um).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(chaveDaParte(CHAVE, 1)).toBe(um); // repetir o envio manda a mesma
    expect(chaveDaParte(CHAVE, 2)).not.toBe(um);
  });
});

describe("executarEngatarVarios", () => {
  const cavalo = base.find((p) => p.tipo === "cavalo" && p.conjunto.implementoIds.length === 0);
  const livres = base.filter(
    (p) => p.tipo === "implemento" && p.conjunto.cavaloId === null && p.sigla === "PÁT",
  );

  it("recusa lista vazia e o cavalo engatado nele mesmo", async () => {
    const vazio = await executarEngatarVarios(
      CHAVE,
      { placa: "ABC1D23", implementos: [], primeiraPosicao: 1, quando: AGORA },
      contexto(),
    );
    expect(vazio.ok).toBe(false);
    const mesmo = await executarEngatarVarios(
      CHAVE,
      { placa: "ABC1D23", implementos: ["ABC1D23"], primeiraPosicao: 1, quando: AGORA },
      contexto(),
    );
    expect(mesmo.ok).toBe(false);
  });

  it("recusa quando as posições passam de 3", async () => {
    const r = await executarEngatarVarios(
      CHAVE,
      { placa: "ABC1D23", implementos: ["AAA1A11", "BBB2B22"], primeiraPosicao: 3, quando: AGORA },
      contexto(),
    );
    expect(r.ok).toBe(false);
  });

  it("chama a fonte uma vez por peça, com a posição seguinte e a chave da parte", async () => {
    type Engatar = (
      entrada: { placa: string },
      chave: string,
    ) => Promise<{ ok: true; linha: never }>;
    const engatar = vi.fn<Engatar>(async (entrada) => ({
      ok: true as const,
      linha: { placa: entrada.placa } as never,
    }));
    const fonte = { engatar } as unknown as FonteDeEscrita;
    const r = await executarEngatarVarios(
      CHAVE,
      { placa: "ABC1D23", implementos: ["AAA1A11", "BBB2B22"], primeiraPosicao: 1, quando: AGORA },
      contexto(fonte),
    );
    expect(r.ok).toBe(true);
    expect(engatar).toHaveBeenCalledTimes(2);
    expect(engatar.mock.calls[0]?.[0]).toMatchObject({ implemento: "AAA1A11", posicao: 1 });
    expect(engatar.mock.calls[0]?.[1]).toBe(CHAVE);
    expect(engatar.mock.calls[1]?.[0]).toMatchObject({ implemento: "BBB2B22", posicao: 2 });
    expect(engatar.mock.calls[1]?.[1]).toBe(chaveDaParte(CHAVE, 1));
  });

  it("uma falha para o lote e a mensagem diz quantos entraram (X de Y)", async () => {
    let n = 0;
    const engatar = vi.fn(async (entrada: { placa: string }) =>
      n++ === 0
        ? { ok: true as const, linha: { placa: entrada.placa } as never }
        : { ok: false as const, erro: { codigo: "falha" as const, mensagem: "Conjunto misto." } },
    );
    const fonte = { engatar } as unknown as FonteDeEscrita;
    const r = await executarEngatarVarios(
      CHAVE,
      {
        placa: "ABC1D23",
        implementos: ["AAA1A11", "BBB2B22", "CCC3C33"],
        primeiraPosicao: 1,
        quando: AGORA,
      },
      contexto(fonte),
    );
    expect(engatar).toHaveBeenCalledTimes(2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.mensagem).toContain("1 de 3");
  });

  it.runIf(cavalo !== undefined && livres.length >= 2)(
    "no exemplo, engata dois implementos soltos no cavalo",
    async () => {
      const r = await executarEngatarVarios(
        CHAVE,
        {
          placa: cavalo!.placa,
          implementos: [livres[0]!.placa, livres[1]!.placa],
          primeiraPosicao: 1,
          quando: AGORA,
        },
        contexto(),
      );
      expect(r.ok).toBe(true);
    },
  );
});
