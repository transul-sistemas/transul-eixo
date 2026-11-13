import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ClienteDeEscrita,
  contarParaReceberNoBanco,
  type ErroDoBanco,
  escritaDoBanco,
  resultadoDoErro,
} from "./escrita-do-banco";

// A escrita pelo banco (3.9b-1): as funções atômicas com a chave de envio e a versão, e o erro do
// Postgres virando resultado tipado. O cliente é um simulado com a forma do Supabase.

const CHAVE = "11111111-1111-4111-8111-111111111111";

const placaDoBanco = {
  ativo_id: "a-1",
  placa: "AAA1A11",
  tipo: "cavalo",
  renavam: "00639884962",
  modelo: "FH 540",
  modelo_id: "m-1",
  marca_id: "ma-1",
  marca: "Volvo",
  ano: 2022,
  sigla: "PÁT",
  desde: "2026-11-01T08:00",
  gestor_id: "g-1",
  gestor: "Gestor 1",
  operacao_id: "o-1",
  operacao: "Operação Matriz",
  cr: "2010101",
  filial_id: null,
  filial: null,
  garagem: "Matriz",
  versao: 3,
};
const pedidoDoBanco = {
  id: "t-1",
  placa: "AAA1A11",
  de_gestor_id: "g-1",
  de_gestor: "Gestor 1",
  para_gestor_id: "g-2",
  para_gestor: "Gestor 2",
  motivo: "Troca",
  situacao: "em_conferencia",
  versao: 2,
  criado_em: "2026-11-06T09:00",
  recebida_em: "2026-11-06T10:00",
  pendencias: [{ id: "p-1", texto: "CRLV", resposta: null, nota: null }],
};

type Respostas = Record<string, { data: unknown; error: ErroDoBanco | null }>;
let respostas: Respostas;
const rpc = vi.fn(async (funcao: string, argumentos?: Record<string, unknown>) => {
  void argumentos;
  return respostas[funcao] ?? { data: null, error: null };
});
const update = vi.fn((valores: Record<string, unknown>) => ({
  valores,
  eq: () => ({
    select: () => ({ single: async () => respostas.update ?? { data: {}, error: null } }),
  }),
}));
const insert = vi.fn((linha: Record<string, unknown>) => ({
  linha,
  select: () => ({ single: async () => respostas.insert ?? { data: null, error: null } }),
}));
const cliente: ClienteDeEscrita = {
  schema: () => ({ rpc, from: () => ({ insert, update }) }),
};
const fonte = escritaDoBanco(async () => cliente);

beforeEach(() => {
  respostas = {};
  rpc.mockClear();
  update.mockClear();
  insert.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("resultadoDoErro: o código do Postgres decide o resultado tipado", () => {
  it("42501 sem permissão, 40001 conflito, regra (23514, 23503, 22xxx, P0001) entrada inválida, o resto falha", () => {
    const codigo = (code: string) => {
      const r = resultadoDoErro({ code, message: "mensagem do banco" });
      return r.ok ? "ok" : r.erro.codigo;
    };
    expect(codigo("42501")).toBe("sem_permissao");
    expect(codigo("40001")).toBe("conflito");
    for (const c of ["23514", "23503", "22023", "P0001", "23505"])
      expect(codigo(c), c).toBe("entrada_invalida");
    expect(codigo("XX000")).toBe("falha");
  });
  it("a mensagem de regra do banco (em português) chega à tela; a de falha, não", () => {
    const regra = resultadoDoErro({ code: "23514", message: "Diga na nota o que ficou pendente." });
    expect(!regra.ok && regra.erro.mensagem).toBe("Diga na nota o que ficou pendente.");
    const falha = resultadoDoErro({ code: "XX000", message: "detalhe interno" });
    expect(!falha.ok && falha.erro.mensagem).not.toMatch(/detalhe interno/);
  });
});

describe("cadastrarPlaca pelo banco", () => {
  const entrada = {
    placa: "AAA1A11",
    renavam: "00639884962",
    tipo: "implemento" as const,
    marcaId: "ma-1",
    modeloId: "m-1",
    ano: 2022,
    gestorId: "g-1",
    operacaoId: "o-1",
    crId: "c-1",
    situacaoInicial: "PÁT" as const,
    funcao: "semirreboque" as const,
    carroceriaId: "car-1",
    eixos: 3,
    valorManualCentavos: 12_345,
    fonteDoValor: "Nota",
    dataDoValor: "2026-09-10",
  };
  it("chama cadastrar_ativo com a chave, a função, a carroceria, os eixos, o ano e o valor (uma transação só) e devolve a linha", async () => {
    respostas.cadastrar_ativo = { data: "a-1", error: null };
    respostas.placa_para_assistente = {
      data: { ...placaDoBanco, tipo: "implemento" },
      error: null,
    };
    const r = await fonte.cadastrarPlaca(entrada, CHAVE, "2026-11-06T09:00");
    expect(rpc).toHaveBeenCalledWith(
      "cadastrar_ativo",
      expect.objectContaining({
        p_tipo: "implemento",
        p_funcao: "semirreboque",
        p_carroceria_id: "car-1",
        p_eixos: 3,
        p_cr_id: "c-1",
        p_operacao_id: "o-1",
        p_chave: CHAVE,
        p_ano_fabricacao: 2022,
        p_valor_manual: 123.45,
        p_valor_manual_fonte: "Nota",
        p_valor_manual_em: "2026-09-10",
      }),
    );
    // Nada de UPDATE separado: se o cadastro gravou, ano e valor gravaram junto.
    expect(update).not.toHaveBeenCalled();
    expect(r.ok && r.linha).toMatchObject({ placa: "AAA1A11", versao: 3 });
  });
  it("placa repetida (23505) vira placa_ja_existe, com a placa que está lá", async () => {
    respostas.cadastrar_ativo = {
      data: null,
      error: { code: "23505", message: "duplicate key placa" },
    };
    respostas.placa_para_assistente = { data: placaDoBanco, error: null };
    const r = await fonte.cadastrarPlaca(entrada, CHAVE, "");
    expect(!r.ok && r.erro.codigo).toBe("placa_ja_existe");
    expect(!r.ok && (r.erro.atual as { placa: string }).placa).toBe("AAA1A11");
    expect(update).not.toHaveBeenCalled();
  });
  it("sem permissão (42501) não grava o valor", async () => {
    respostas.cadastrar_ativo = {
      data: null,
      error: { code: "42501", message: "Você não tem permissão para cadastrar placas." },
    };
    const r = await fonte.cadastrarPlaca(entrada, CHAVE, "");
    expect(!r.ok && r.erro.codigo).toBe("sem_permissao");
    expect(update).not.toHaveBeenCalled();
  });
});

describe("as transferências pelo banco", () => {
  it("receber: conflito de versão (40001) traz o pedido como está agora", async () => {
    respostas.receber_placa = { data: null, error: { code: "40001", message: "mudou" } };
    respostas.pedido_aberto_da_placa = { data: pedidoDoBanco, error: null };
    const r = await fonte.receberPlaca(
      { placa: "AAA1A11", pedidoId: "t-1", versaoDoPedido: 1, conferido: true },
      CHAVE,
      "",
      "g-2",
    );
    expect(rpc).toHaveBeenCalledWith("receber_placa", {
      p_transferencia_id: "t-1",
      p_versao: 1,
      p_chave: CHAVE,
    });
    expect(!r.ok && r.erro.codigo).toBe("conflito");
    expect(!r.ok && r.erro.atual).toMatchObject({
      situacao: "em_conferencia",
      versao: 2,
      deGestor: "Gestor 1",
    });
  });
  it("concluir manda cada resposta (resolvida e nota) e devolve a placa", async () => {
    respostas.concluir_recebimento = { data: "t-1", error: null };
    respostas.placa_para_assistente = { data: { ...placaDoBanco, gestor_id: "g-2" }, error: null };
    const r = await fonte.concluirRecebimento(
      {
        placa: "AAA1A11",
        pedidoId: "t-1",
        versaoDoPedido: 2,
        pendencias: [{ id: "p-1", resolvida: false, nota: "Em dezembro" }],
      },
      CHAVE,
      "",
      "g-2",
    );
    expect(rpc).toHaveBeenCalledWith("concluir_recebimento", {
      p_transferencia_id: "t-1",
      p_versao: 2,
      p_respostas: [{ id: "p-1", resolvida: false, nota: "Em dezembro" }],
      p_chave: CHAVE,
    });
    expect(r.ok && r.linha.gestorId).toBe("g-2");
  });
  it("disponibilizar passa o ativo, o destino, o motivo, as pendências e a versão", async () => {
    respostas.placa_para_assistente = { data: placaDoBanco, error: null };
    respostas.disponibilizar_placa = { data: "t-9", error: null };
    respostas.pedido_aberto_da_placa = {
      data: { ...pedidoDoBanco, situacao: "pendente", versao: 1 },
      error: null,
    };
    const r = await fonte.disponibilizarPlaca(
      {
        placa: "AAA1A11",
        paraGestorId: "g-2",
        motivo: "Troca",
        pendenciasConhecidas: ["CRLV"],
        versaoDaPlaca: 3,
      },
      CHAVE,
      "",
    );
    expect(rpc).toHaveBeenCalledWith("disponibilizar_placa", {
      p_ativo_id: "a-1",
      p_para_gestor_id: "g-2",
      p_motivo: "Troca",
      p_pendencias: ["CRLV"],
      p_versao: 3,
      p_chave: CHAVE,
    });
    expect(r.ok && r.linha.situacao).toBe("pendente");
  });
});

describe("o + e a contagem pelo banco", () => {
  it("o CR vai por criar_cr com o CODCENCUS; operação nova é recusada (é do módulo Operações)", async () => {
    respostas.criar_cr = { data: "cr-9", error: null };
    const r = await fonte.criarItemDeCatalogo(
      { tipo: "cr", nome: "2010101", codcencus: 2010101 },
      CHAVE,
    );
    expect(rpc).toHaveBeenCalledWith("criar_cr", {
      p_codcencus: 2010101,
      p_codigo: "2010101",
      p_nome: "2010101",
      p_chave: CHAVE,
    });
    expect(r.ok && r.linha.id).toBe("cr-9");
    const op = await fonte.criarItemDeCatalogo({ tipo: "operacao", nome: "Nova" }, CHAVE);
    expect(!op.ok && op.erro.mensagem).toMatch(/módulo Operações/);
    expect(fonte.criaveis).toEqual(["marca", "modelo", "cr"]);
  });
  it("a contagem do que espera por quem usa vem pronta do banco; erro conta zero", async () => {
    respostas.contar_para_receber = { data: 2, error: null };
    expect(await contarParaReceberNoBanco(cliente)).toBe(2);
    respostas.contar_para_receber = { data: null, error: { message: "fora" } };
    expect(await contarParaReceberNoBanco(cliente)).toBe(0);
  });
});

describe("a ficha da placa pelo banco: situação, conjunto e correção", () => {
  beforeEach(() => {
    respostas.placa_para_assistente = { data: placaDoBanco, error: null };
  });
  it("mudar situação chama registrar_evento com o instante de São Paulo e devolve a placa", async () => {
    respostas.registrar_evento = { data: "e-1", error: null };
    const r = await fonte.mudarSituacao(
      { placa: "AAA1A11", sigla: "MAN", quando: "2026-11-09T09:30" },
      CHAVE,
      "2026-11-09T10:00",
    );
    expect(rpc).toHaveBeenCalledWith("registrar_evento", {
      p_ativo_id: "a-1",
      p_sigla: "MAN",
      p_em: "2026-11-09T09:30:00-03:00",
      p_origem: "manual",
    });
    expect(r.ok && r.linha.placa).toBe("AAA1A11");
  });
  it("a regra do banco (sigla que não vale) volta como entrada inválida, com a mensagem dele", async () => {
    respostas.registrar_evento = {
      data: null,
      error: { code: "23514", message: "A situação CAr não vale para esta placa." },
    };
    const r = await fonte.mudarSituacao(
      { placa: "AAA1A11", sigla: "CAr", quando: "2026-11-09T09:30" },
      CHAVE,
      "2026-11-09T10:00",
    );
    expect(!r.ok && r.erro.codigo).toBe("entrada_invalida");
    expect(!r.ok && r.erro.mensagem).toMatch(/não vale/);
  });
  it("engatar e desatrelar passam os ids, a posição e o instante", async () => {
    respostas.engatar = { data: "c-1", error: null };
    respostas.desatrelar = { data: 1, error: null };
    const e = await fonte.engatar(
      { placa: "AAA1A11", implemento: "AAA1A11", posicao: 2, quando: "2026-11-09T09:30" },
      CHAVE,
      "2026-11-09T10:00",
    );
    expect(rpc).toHaveBeenCalledWith("engatar", {
      p_cavalo_id: "a-1",
      p_implemento_id: "a-1",
      p_posicao: 2,
      p_em: "2026-11-09T09:30:00-03:00",
    });
    expect(e.ok).toBe(true);
    const d = await fonte.desatrelar(
      { placa: "AAA1A11", implementos: ["AAA1A11"], quando: "2026-11-09T09:30" },
      CHAVE,
      "2026-11-09T10:00",
    );
    expect(rpc).toHaveBeenCalledWith("desatrelar", {
      p_cavalo_id: "a-1",
      p_em: "2026-11-09T09:30:00-03:00",
      p_implementos: ["a-1"],
    });
    expect(d.ok).toBe(true);
  });
  it("corrigir: chave por update, eixos e carroceria por corrigir_campo sem versão nem chave", async () => {
    respostas.corrigir_campo = { data: "x", error: null };
    const r = await fonte.corrigirPlaca(
      {
        placa: "AAA1A11",
        versaoDaPlaca: 3,
        motivo: "Conferido no CRLV",
        renavam: "00639884962",
        eixos: 3,
        carroceriaId: "car-1",
      },
      CHAVE,
      "2026-11-09T10:00",
    );
    expect(update).toHaveBeenCalledWith({ renavam: "00639884962" });
    const chamadas = rpc.mock.calls.filter(([f]) => f === "corrigir_campo");
    expect(chamadas).toHaveLength(2);
    expect(chamadas[0]?.[1]).toMatchObject({
      p_campo: "eixos",
      p_valor: 3,
      p_motivo: "Conferido no CRLV",
      p_chave: null,
      p_versao: null,
    });
    expect(r.ok).toBe(true);
  });
  it("corrigir só campos: a primeira correção leva a chave e a versão; versão velha dá conflito", async () => {
    respostas.corrigir_campo = { data: "x", error: null };
    await fonte.corrigirPlaca(
      { placa: "AAA1A11", versaoDaPlaca: 3, motivo: "m", eixos: 3 },
      CHAVE,
      "2026-11-09T10:00",
    );
    expect(rpc).toHaveBeenCalledWith(
      "corrigir_campo",
      expect.objectContaining({ p_chave: CHAVE, p_versao: 3, p_campo: "eixos" }),
    );
    const velho = await fonte.corrigirPlaca(
      { placa: "AAA1A11", versaoDaPlaca: 2, motivo: "m", eixos: 3 },
      CHAVE,
      "2026-11-09T10:00",
    );
    expect(!velho.ok && velho.erro.codigo).toBe("conflito");
  });
  it("trocar uma chave preenchida (23000) volta como entrada inválida", async () => {
    respostas.update = {
      data: null,
      error: { code: "23000", message: "A chave renavam não aceita correção local." },
    };
    const r = await fonte.corrigirPlaca(
      { placa: "AAA1A11", versaoDaPlaca: 3, motivo: "m", renavam: "00639884962" },
      CHAVE,
      "2026-11-09T10:00",
    );
    expect(!r.ok && r.erro.codigo).toBe("entrada_invalida");
  });
  it("o conjunto lê o cavalo e os implementos do detalhe e o nome da nomenclatura", async () => {
    respostas.detalhe_da_placa = {
      data: { cavalo: null, implementos: ["BBB2B22", "CCC3C33"] },
      error: null,
    };
    respostas.nome_do_conjunto = { data: "Bitrem Sider", error: null };
    const c = await fonte.conjuntoDaPlaca("AAA1A11");
    expect(c).toEqual({
      cavalo: "AAA1A11",
      implementos: ["BBB2B22", "CCC3C33"],
      nome: "Bitrem Sider",
    });
    expect(rpc).toHaveBeenCalledWith("nome_do_conjunto", { p_cavalo_id: "a-1" });
    respostas.detalhe_da_placa = { data: { cavalo: null, implementos: [] }, error: null };
    expect(await fonte.conjuntoDaPlaca("AAA1A11")).toBeNull();
  });
  it("os implementos livres são os sem cavalo e dentro da frota", async () => {
    respostas.listar_placas = {
      data: {
        linhas: [
          { placa: "BBB2B22", modelo: "Sider", sigla: "PÁT", cavalo: null },
          { placa: "CCC3C33", modelo: "Sider", sigla: "PÁT", cavalo: "AAA1A11" },
          { placa: "DDD4D44", modelo: "Baú", sigla: "ALU", cavalo: null },
        ],
      },
      error: null,
    };
    expect(await fonte.implementosLivres()).toEqual([
      { placa: "BBB2B22", nome: "BBB2B22 · Sider" },
    ]);
  });

  it("os cavalos para engatar (aba Soltas): só cavalos, sem as baixadas", async () => {
    respostas.listar_placas = {
      data: { linhas: [{ placa: "AAA1A11", modelo: "FH 540", sigla: "PÁT" }] },
      error: null,
    };
    expect(await fonte.cavalosParaEngatar()).toEqual([
      { placa: "AAA1A11", nome: "AAA1A11 · FH 540" },
    ]);
    expect(rpc).toHaveBeenCalledWith(
      "listar_placas",
      expect.objectContaining({ p_tipos: ["cavalo"], p_baixadas: false }),
    );
  });
});

describe("placasQuePodemSerEntregues pelo banco: sem o limite de 100 placas", () => {
  it("lê as páginas até o fim", async () => {
    const linha = (n: number) => ({
      placa: `AAA${String(n).padStart(4, "0")}`,
      modelo: "FH",
      tipo: "cavalo",
      sigla: "PÁT",
    });
    rpc.mockImplementation(async (funcao: string, argumentos?: Record<string, unknown>) => {
      if (funcao !== "listar_placas") return { data: null, error: null };
      const pagina = Number(argumentos?.p_pagina);
      const tam = Number(argumentos?.p_tam);
      const total = 250;
      const inicio = (pagina - 1) * tam;
      const linhas = Array.from({ length: Math.max(0, Math.min(tam, total - inicio)) }, (_, i) =>
        linha(inicio + i),
      );
      return { data: { linhas, total }, error: null };
    });
    try {
      expect(await fonte.placasQuePodemSerEntregues()).toHaveLength(250);
    } finally {
      rpc.mockImplementation(
        async (funcao: string) => respostas[funcao] ?? { data: null, error: null },
      );
    }
  });
});
