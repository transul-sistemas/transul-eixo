import { describe, expect, it } from "vitest";
import {
  contadorDaPorta,
  esquemaRespostaDaPosicao,
  respostaContinua,
  respostaNaFilial,
} from "./posicao-do-dia";

// A porta da Posição do dia (M2): "N de M preenchidos" e as respostas de um toque.

const conjunto = (parcial: Record<string, unknown> = {}) => ({
  ativo_id: "11111111-1111-4111-8111-111111111111",
  placa: "ZDM0A00",
  sigla: "ETc",
  cidade_da_filial: { id: 4205407, nome: "Florianópolis", uf: "SC" },
  ontem: { dia: "2026-11-12", cidade_id: 3550308, cidade: "São Paulo", uf: "SP", sem_sinal: false },
  hoje: null,
  ...parcial,
});

describe("contadorDaPorta", () => {
  it("conta quem já tem resposta hoje e só deixa concluir com todos", () => {
    const lista = [conjunto(), conjunto({ hoje: { versao: 1 } })];
    expect(contadorDaPorta(lista)).toEqual({ respondidos: 1, total: 2, podeConcluir: false });
    expect(contadorDaPorta([conjunto({ hoje: { versao: 1 } })]).podeConcluir).toBe(true);
  });
  it("sem conjunto, nada a responder: pode concluir", () => {
    expect(contadorDaPorta([])).toEqual({ respondidos: 0, total: 0, podeConcluir: true });
  });
});

describe("respostas de um toque", () => {
  it("Continua em: a cidade de ontem, com a sigla de agora", () => {
    expect(respostaContinua(conjunto(), "2026-11-13")).toMatchObject({
      dia: "2026-11-13",
      cidadeId: 3550308,
      semSinal: false,
      sigla: "ETc",
      versao: null,
    });
  });
  it("Continua em não existe sem cidade ontem", () => {
    expect(respostaContinua(conjunto({ ontem: null }), "2026-11-13")).toBeNull();
  });
  it("No pátio da filial: a cidade da filial", () => {
    expect(respostaNaFilial(conjunto(), "2026-11-13")?.cidadeId).toBe(4205407);
    expect(respostaNaFilial(conjunto({ cidade_da_filial: null }), "2026-11-13")).toBeNull();
  });
  it("corrigir leva a versão que já está gravada", () => {
    expect(respostaContinua(conjunto({ hoje: { versao: 3 } }), "2026-11-13")?.versao).toBe(3);
  });
});

describe("esquemaRespostaDaPosicao", () => {
  const ok = {
    ativoId: "11111111-1111-4111-8111-111111111111",
    dia: "2026-11-13",
    cidadeId: 1,
    semSinal: false,
    motivo: null,
    sigla: null,
    confirmouAlerta: false,
    versao: null,
  };
  it("aceita cidade", () => {
    expect(esquemaRespostaDaPosicao.safeParse(ok).success).toBe(true);
  });
  it("sem sinal pede o motivo", () => {
    const r = esquemaRespostaDaPosicao.safeParse({ ...ok, cidadeId: null, semSinal: true });
    expect(r.success).toBe(false);
  });
  it("sem cidade e sem 'sem sinal' é recusado", () => {
    expect(esquemaRespostaDaPosicao.safeParse({ ...ok, cidadeId: null }).success).toBe(false);
  });
});
