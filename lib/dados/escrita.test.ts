import { describe, expect, it } from "vitest";
import {
  MENSAGEM_DE_TIPO_QUE_NAO_DISPONIBILIZA,
  podeDisponibilizar,
  SIGLAS_QUE_PODEM_DISPONIBILIZAR,
  type PedidoDeTransferencia,
} from "@/lib/dominio/custodia";
import { criarArmazem } from "@/lib/exemplo/armazem";
import { placasDeExemplo } from "@/lib/exemplo/placas";
import {
  executarCadastrarPlaca,
  executarCriarItemDeCatalogo,
  executarDisponibilizar,
  executarReceber,
} from "./escrita";
import type { FonteDeEscrita } from "./fonte";
import { escritaDoArmazem } from "./fonte-de-exemplo";

const HOJE = "2026-10-31";
const AGORA = "2026-10-31T09:30";
const CHAVE_A = "11111111-1111-4111-8111-111111111111";
const CHAVE_B = "22222222-2222-4222-8222-222222222222";

const base = placasDeExemplo(HOJE);
const emOrigem = (sigla: string) =>
  (SIGLAS_QUE_PODEM_DISPONIBILIZAR as readonly string[]).includes(sigla);
const noPatio = base.find((p) => podeDisponibilizar(p.sigla, p.tipo))!;
const carretaNoPatio = base.find((p) => p.tipo === "implemento" && emOrigem(p.sigla))!;
const foraDoPatio = base.find((p) => !emOrigem(p.sigla) && p.sigla !== "VND" && p.sigla !== "SUC")!;
const implemento = base.find(
  (p) => p.tipo === "implemento" && p.sigla !== "VND" && p.sigla !== "SUC",
)!;

const pedido = (placa: string, id = "ped-1"): PedidoDeTransferencia => ({
  id,
  placa,
  deGestorId: "gestor-1",
  paraGestorId: "gestor-2",
  motivo: "Troca de carteira",
  pendenciasConhecidas: [{ id: "p1", texto: "CRLV vencendo" }],
  situacao: "pendente",
  versao: 1,
});

function contexto(fonte?: FonteDeEscrita) {
  const armazem = criarArmazem({
    placasBase: base,
    pedidosBase: [pedido(foraDoPatio.placa), pedido(implemento.placa, "ped-i")],
  });
  return {
    fonte: fonte ?? escritaDoArmazem(armazem),
    agora: AGORA,
    hoje: HOJE,
    gestorId: "gestor-2",
    armazem,
  };
}

const cadastro = (parcial: Record<string, unknown> = {}) => ({
  placa: "zzz-9z99",
  renavam: "00639884962",
  tipo: "cavalo",
  marcaId: "marca-volvo",
  modeloId: "modelo-fh-540",
  ano: 2022,
  codigoFipe: "509035-0",
  valorFipeCentavos: 78_500_000,
  gestorId: "gestor-1",
  operacaoId: "op-1",
  crId: "cr-1001",
  filialId: "filial-a",
  garagemId: "garagem-a1",
  situacaoInicial: "PÁT",
  ...parcial,
});

describe("executarCadastrarPlaca: valida com o esquema da tela e grava pela fonte", () => {
  it("grava e devolve a linha, normalizando a placa", async () => {
    const ctx = contexto();
    const r = await executarCadastrarPlaca(CHAVE_A, cadastro(), ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.linha).toMatchObject({ placa: "ZZZ9Z99", versao: 1, sigla: "PÁT" });
    expect((await ctx.fonte.placaParaAssistente("ZZZ9Z99"))?.placa).toBe("ZZZ9Z99");
  });

  it("entrada que não passa no esquema vira entrada_invalida, com as mensagens por campo, e não grava", async () => {
    const ctx = contexto();
    const r = await executarCadastrarPlaca(CHAVE_A, cadastro({ placa: "AB", renavam: "123" }), ctx);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.codigo).toBe("entrada_invalida");
    expect(Object.keys(r.erro.campos ?? {})).toEqual(expect.arrayContaining(["placa", "renavam"]));
    expect(r.erro.campos?.placa?.[0]).toMatch(/Placa inválida/);
    expect(ctx.armazem.placasCadastradas()).toHaveLength(0);
  });

  it("lixo que nem é objeto também vira entrada_invalida, sem lançar", async () => {
    const ctx = contexto();
    for (const lixo of [null, undefined, 5, "texto", [], {}]) {
      const r = await executarCadastrarPlaca(CHAVE_A, lixo, ctx);
      expect(r.ok, String(lixo)).toBe(false);
      if (!r.ok) expect(r.erro.codigo).toBe("entrada_invalida");
    }
  });

  it("o ano máximo é o ano de hoje mais um", async () => {
    const ctx = contexto();
    expect((await executarCadastrarPlaca(CHAVE_A, cadastro({ ano: 2027 }), ctx)).ok).toBe(true);
    const r = await executarCadastrarPlaca(CHAVE_B, cadastro({ placa: "ZZZ9Z98", ano: 2028 }), ctx);
    expect(r.ok).toBe(false);
  });

  it("a mesma chave grava uma vez só", async () => {
    const ctx = contexto();
    const primeira = await executarCadastrarPlaca(CHAVE_A, cadastro(), ctx);
    const segunda = await executarCadastrarPlaca(CHAVE_A, cadastro(), ctx);
    expect(segunda).toEqual(primeira);
    expect(ctx.armazem.placasCadastradas()).toHaveLength(1);
  });

  it("placa que já existe devolve placa_ja_existe com a placa que está lá", async () => {
    const ctx = contexto();
    const r = await executarCadastrarPlaca(CHAVE_A, cadastro({ placa: base[0]!.placa }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro.codigo).toBe("placa_ja_existe");
      expect((r.erro.atual as { placa: string }).placa).toBe(base[0]!.placa);
    }
  });

  it("a chave de envio é conferida: o que não é UUID vira entrada_invalida", async () => {
    const ctx = contexto();
    for (const chave of ["", "abc", "1234"]) {
      const r = await executarCadastrarPlaca(chave, cadastro(), ctx);
      expect(r.ok, chave).toBe(false);
      if (!r.ok) expect(r.erro.codigo).toBe("entrada_invalida");
    }
  });
});

describe("executarDisponibilizar", () => {
  const entrada = (parcial: Record<string, unknown> = {}) => ({
    placa: noPatio.placa.toLowerCase(),
    filialId: "filial-b",
    versaoDaPlaca: 1,
    ...parcial,
  });
  it("leva a placa para DOp com a filial", async () => {
    const ctx = contexto();
    const r = await executarDisponibilizar(CHAVE_A, entrada(), ctx);
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.linha).toMatchObject({ sigla: "DOp", filial: "Filial Exemplo B", versao: 2 });
  });
  it("entrada fora do esquema (versão 0, sem filial) vira entrada_invalida", async () => {
    const ctx = contexto();
    const r = await executarDisponibilizar(
      CHAVE_A,
      entrada({ versaoDaPlaca: 0, filialId: "" }),
      ctx,
    );
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(Object.keys(r.erro.campos ?? {})).toEqual(
        expect.arrayContaining(["versaoDaPlaca", "filialId"]),
      );
  });
  it("versão velha devolve conflito com a placa atual", async () => {
    const ctx = contexto();
    await executarDisponibilizar(CHAVE_A, entrada(), ctx);
    const r = await executarDisponibilizar(CHAVE_B, entrada({ filialId: "filial-c" }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("conflito");
  });
  it("carreta em PÁT, VAz ou ETv é recusada no servidor, com a mensagem do tipo no campo da placa, e nada muda", async () => {
    const ctx = contexto();
    const r = await executarDisponibilizar(CHAVE_A, entrada({ placa: carretaNoPatio.placa }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro.codigo).toBe("entrada_invalida");
      expect(r.erro.campos?.placa?.[0]).toBe(MENSAGEM_DE_TIPO_QUE_NAO_DISPONIBILIZA);
    }
    const depois = await ctx.fonte.placaParaAssistente(carretaNoPatio.placa);
    expect(depois?.sigla).toBe(carretaNoPatio.sigla);
    expect(depois?.versao).toBe(1);
  });
  it("placa que não existe é nao_encontrado", async () => {
    const ctx = contexto();
    const r = await executarDisponibilizar(CHAVE_A, entrada({ placa: "QQQ0Q00" }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("nao_encontrado");
  });
});

describe("executarReceber: o esquema depende do tipo da placa", () => {
  const entrada = (placa: string, parcial: Record<string, unknown> = {}) => ({
    placa,
    pedidoId: placa === implemento.placa ? "ped-i" : "ped-1",
    versaoDoPedido: 1,
    versaoDaPlaca: 1,
    conferido: true,
    situacao: "MAN",
    operacaoId: "op-2",
    crId: "cr-1002",
    motoristaId: null,
    metaDoConjuntoCentavos: null,
    conjunto: { cavaloId: null, implementoIds: [] },
    pendencias: [{ id: "p1", resolvida: true }],
    ...parcial,
  });
  it("conclui o pedido, troca o gestor e muda situação, operação e CR", async () => {
    const ctx = contexto();
    const r = await executarReceber(CHAVE_A, entrada(foraDoPatio.placa), ctx);
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.linha).toMatchObject({
        gestor: "Gestor Exemplo 2",
        sigla: "MAN",
        operacao: "Operação Exemplo 2",
      });
    expect(await ctx.fonte.pedidoPendenteDa(foraDoPatio.placa)).toBeNull();
  });
  it("conjunto misto de carrocerias é recusado no servidor, e nada muda", async () => {
    const ctx = contexto();
    const candidatos = await ctx.fonte.candidatosDoConjunto(foraDoPatio.placa);
    const sider = candidatos.find((c) => c.carroceria === "Sider");
    const graneleiro = candidatos.find((c) => c.carroceria === "Graneleiro");
    expect(sider && graneleiro).toBeTruthy();
    const r = await executarReceber(
      CHAVE_A,
      entrada(foraDoPatio.placa, {
        conjunto: { cavaloId: null, implementoIds: [sider?.id, graneleiro?.id] },
      }),
      ctx,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erro.campos ?? {})).toContain("conjunto.implementoIds");
    expect(await ctx.fonte.pedidoPendenteDa(foraDoPatio.placa)).not.toBeNull();
  });
  it("não conferido é recusado pelo esquema, e nada muda", async () => {
    const ctx = contexto();
    const r = await executarReceber(CHAVE_A, entrada(foraDoPatio.placa, { conferido: false }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erro.campos ?? {})).toContain("conferido");
    expect(await ctx.fonte.pedidoPendenteDa(foraDoPatio.placa)).not.toBeNull();
  });
  it("pendência aberta é recusada pelo esquema, e nada muda", async () => {
    const ctx = contexto();
    const r = await executarReceber(
      CHAVE_A,
      entrada(foraDoPatio.placa, { pendencias: [{ id: "p1", resolvida: false }] }),
      ctx,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erro.campos ?? {})).toContain("pendencias");
    expect(await ctx.fonte.pedidoPendenteDa(foraDoPatio.placa)).not.toBeNull();
  });
  it("meta do conjunto em quem não é cavalo é recusada pelo esquema do tipo", async () => {
    const ctx = contexto();
    const r = await executarReceber(
      CHAVE_A,
      entrada(implemento.placa, { metaDoConjuntoCentavos: 1_500_000 }),
      ctx,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erro.campos ?? {})).toContain("metaDoConjuntoCentavos");
  });
  it("quem não é o gestor de destino não recebe (sem_permissao)", async () => {
    const ctx = { ...contexto(), gestorId: "gestor-3" };
    const r = await executarReceber(CHAVE_A, entrada(foraDoPatio.placa), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("sem_permissao");
  });
  it("placa que não existe é nao_encontrado, e lixo é entrada_invalida", async () => {
    const ctx = contexto();
    const r = await executarReceber(CHAVE_A, entrada("QQQ0Q00"), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("nao_encontrado");
    const lixo = await executarReceber(CHAVE_B, 5, ctx);
    expect(lixo.ok).toBe(false);
    if (!lixo.ok) expect(lixo.erro.codigo).toBe("entrada_invalida");
  });
});

describe("executarCriarItemDeCatalogo", () => {
  it("cria o item e o devolve", async () => {
    const ctx = contexto();
    const r = await executarCriarItemDeCatalogo(CHAVE_A, { tipo: "marca", nome: "DAF" }, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.linha).toMatchObject({ tipo: "marca", nome: "DAF" });
    expect((await ctx.fonte.catalogos()).marcas.some((m) => m.nome === "DAF")).toBe(true);
  });
  it("o esquema recusa modelo sem marca e CR fora do formato", async () => {
    const ctx = contexto();
    const r1 = await executarCriarItemDeCatalogo(CHAVE_A, { tipo: "modelo", nome: "XF" }, ctx);
    expect(r1.ok).toBe(false);
    const r2 = await executarCriarItemDeCatalogo(
      CHAVE_B,
      { tipo: "cr", nome: "1006", paiId: "op-1" },
      ctx,
    );
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.erro.campos?.nome?.[0]).toMatch(/CR-0000/);
  });
  it("nome repetido é entrada_invalida no campo nome", async () => {
    const ctx = contexto();
    const r = await executarCriarItemDeCatalogo(CHAVE_A, { tipo: "marca", nome: "volvo" }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erro.campos ?? {})).toContain("nome");
  });
});

describe("nada lança: falha da fonte vira erro tipado", () => {
  it("fonte que lança devolve falha, com a mensagem de como resolver", async () => {
    const quebrada = new Proxy({} as FonteDeEscrita, {
      get: () => () => Promise.reject(new Error("banco fora do ar")),
    });
    const ctx = contexto(quebrada);
    const r = await executarCadastrarPlaca(CHAVE_A, cadastro(), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro.codigo).toBe("falha");
      expect(r.erro.mensagem).toMatch(/Tente de novo/);
      expect(r.erro.mensagem).not.toMatch(/banco fora do ar/); // o detalhe interno não vaza para a tela
    }
  });
});
