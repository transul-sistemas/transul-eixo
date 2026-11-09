import { describe, expect, it, vi } from "vitest";
import {
  MENSAGEM_DE_TIPO_QUE_NAO_ENTREGA,
  podeEntregar,
  SIGLAS_QUE_PODEM_ENTREGAR,
  type PedidoDeTransferencia,
} from "@/lib/dominio/custodia";
import { criarArmazem } from "@/lib/exemplo/armazem";
import { placasDeExemplo } from "@/lib/exemplo/placas";
import {
  executarCadastrarPlaca,
  executarCancelarPedido,
  executarConcluirRecebimento,
  executarDevolverPlaca,
  executarCriarItemDeCatalogo,
  executarDisponibilizarPlaca,
  executarEntregarAoOperacional,
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
  (SIGLAS_QUE_PODEM_ENTREGAR as readonly string[]).includes(sigla);
const noPatio = base.find((p) => podeEntregar(p.sigla, p.tipo))!;
const carretaNoPatio = base.find((p) => p.tipo === "implemento" && emOrigem(p.sigla))!;
const foraDoPatio = base.find((p) => !emOrigem(p.sigla) && p.sigla !== "VND" && p.sigla !== "SUC")!;

const pedido = (placa: string, id = "ped-1"): PedidoDeTransferencia => ({
  id,
  placa,
  deGestorId: "gestor-1",
  deGestor: "Gestor Exemplo 1",
  paraGestorId: "gestor-2",
  paraGestor: "Gestor Exemplo 2",
  motivo: "Troca de carteira",
  pendenciasConhecidas: [{ id: "p1", texto: "CRLV vencendo" }],
  situacao: "pendente",
  versao: 1,
});

function contexto(fonte?: FonteDeEscrita, gestorId = "gestor-2") {
  const armazem = criarArmazem({ placasBase: base, pedidosBase: [pedido(foraDoPatio.placa)] });
  return { fonte: fonte ?? escritaDoArmazem(armazem), agora: AGORA, hoje: HOJE, gestorId, armazem };
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
  situacaoInicial: "PÁT",
  ...parcial,
});

describe("executarCadastrarPlaca: valida com o esquema da tela e grava pela fonte", () => {
  it("grava e devolve a linha, normalizando a placa", async () => {
    const ctx = contexto();
    const r = await executarCadastrarPlaca(CHAVE_A, cadastro(), ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.linha).toMatchObject({ placa: "ZZZ9Z99", versao: 1, sigla: "PÁT" });
  });

  it("entrada que não passa no esquema vira entrada_invalida, com as mensagens por campo, e não grava", async () => {
    const ctx = contexto();
    const r = await executarCadastrarPlaca(
      CHAVE_A,
      cadastro({ placa: "AB", renavam: "123", operacaoId: "" }),
      ctx,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.codigo).toBe("entrada_invalida");
    expect(Object.keys(r.erro.campos ?? {})).toEqual(
      expect.arrayContaining(["placa", "renavam", "operacaoId"]),
    );
    expect(ctx.armazem.placasCadastradas()).toHaveLength(0);
  });

  it("implemento grava com função, carroceria e eixos", async () => {
    const ctx = contexto();
    const r = await executarCadastrarPlaca(
      CHAVE_A,
      cadastro({
        tipo: "implemento",
        modeloId: "modelo-sider",
        marcaId: "marca-randon",
        funcao: "semirreboque",
        carroceriaId: "carroceria-sider",
        eixos: 3,
        valorManualCentavos: 2_500_000,
        fonteDoValor: "Nota fiscal",
        dataDoValor: "2026-09-10",
      }),
      ctx,
    );
    expect(r.ok).toBe(true);
  });

  it("lixo que nem é objeto também vira entrada_invalida, sem lançar", async () => {
    const ctx = contexto();
    for (const lixo of [null, undefined, 5, "texto", [], {}]) {
      const r = await executarCadastrarPlaca(CHAVE_A, lixo, ctx);
      expect(r.ok, String(lixo)).toBe(false);
      if (!r.ok) expect(r.erro.codigo).toBe("entrada_invalida");
    }
  });

  it("a mesma chave grava uma vez só e devolve o mesmo resultado", async () => {
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

describe("executarEntregarAoOperacional", () => {
  const entrega = (parcial: Record<string, unknown> = {}) => ({
    placa: noPatio.placa,
    filialId: "filial-b",
    versaoDaPlaca: 1,
    ...parcial,
  });
  it("leva a placa para DOp com a filial", async () => {
    const r = await executarEntregarAoOperacional(CHAVE_A, entrega(), contexto());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.linha).toMatchObject({ sigla: "DOp", filialId: "filial-b", versao: 2 });
  });
  it("versão velha devolve conflito com a placa atual", async () => {
    const ctx = contexto();
    await executarEntregarAoOperacional(CHAVE_A, entrega(), ctx);
    const r = await executarEntregarAoOperacional(CHAVE_B, entrega(), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro.codigo).toBe("conflito");
      expect((r.erro.atual as { versao: number }).versao).toBe(2);
    }
  });
  it("carreta é recusada no servidor, com a mensagem do tipo no campo da placa", async () => {
    const r = await executarEntregarAoOperacional(
      CHAVE_A,
      entrega({ placa: carretaNoPatio.placa }),
      contexto(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.campos?.placa?.[0]).toBe(MENSAGEM_DE_TIPO_QUE_NAO_ENTREGA);
  });
  it("placa que não existe é nao_encontrado", async () => {
    const r = await executarEntregarAoOperacional(
      CHAVE_A,
      entrega({ placa: "ZZZ9Z99" }),
      contexto(),
    );
    expect(!r.ok && r.erro.codigo).toBe("nao_encontrado");
  });
});

describe("executarDisponibilizarPlaca, executarReceber e executarConcluirRecebimento", () => {
  const envio = (parcial: Record<string, unknown> = {}) => ({
    placa: noPatio.placa,
    paraGestorId: "gestor-3",
    motivo: "Troca de carteira",
    pendenciasConhecidas: ["CRLV vencendo"],
    versaoDaPlaca: 1,
    ...parcial,
  });

  it("disponibilizar abre o pedido pendente, com as pendências; a placa não muda de gestor", async () => {
    const ctx = contexto();
    const r = await executarDisponibilizarPlaca(CHAVE_A, envio(), ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linha).toMatchObject({ situacao: "pendente", paraGestorId: "gestor-3" });
    expect(r.linha.pendenciasConhecidas.map((p) => p.texto)).toEqual(["CRLV vencendo"]);
    const placa = await ctx.fonte.placaParaAssistente(noPatio.placa);
    expect(placa?.gestor).toBe(noPatio.gestor);
  });

  it("disponibilizar de novo, com pedido aberto, é recusado; sem motivo, também", async () => {
    const ctx = contexto();
    await executarDisponibilizarPlaca(CHAVE_A, envio(), ctx);
    const r = await executarDisponibilizarPlaca(CHAVE_B, envio(), ctx);
    expect(!r.ok && r.erro.codigo).toBe("entrada_invalida");
    const semMotivo = await executarDisponibilizarPlaca(
      CHAVE_B,
      envio({ motivo: " " }),
      contexto(),
    );
    expect(!semMotivo.ok && semMotivo.erro.campos?.motivo).toBeTruthy();
  });

  it("receber registra a chegada (em conferência) sem trocar o gestor; concluir troca", async () => {
    const ctx = contexto();
    const recebido = await executarReceber(
      CHAVE_A,
      { placa: foraDoPatio.placa, pedidoId: "ped-1", versaoDoPedido: 1, conferido: true },
      ctx,
    );
    expect(recebido.ok && recebido.linha.situacao).toBe("em_conferencia");
    expect((await ctx.fonte.placaParaAssistente(foraDoPatio.placa))?.gestor).toBe(
      foraDoPatio.gestor,
    );
    const concluido = await executarConcluirRecebimento(
      CHAVE_B,
      {
        placa: foraDoPatio.placa,
        pedidoId: "ped-1",
        versaoDoPedido: 2,
        pendencias: [{ id: "p1", resolvida: false, nota: "Renovação marcada" }],
      },
      ctx,
    );
    expect(concluido.ok && concluido.linha.gestorId).toBe("gestor-2");
  });

  it("receber com a versão do pedido velha é conflito, com o pedido atual", async () => {
    const ctx = contexto();
    const entrada = {
      placa: foraDoPatio.placa,
      pedidoId: "ped-1",
      versaoDoPedido: 1,
      conferido: true,
    };
    await executarReceber(CHAVE_A, entrada, ctx);
    const r = await executarReceber(CHAVE_B, entrada, ctx);
    expect(!r.ok && r.erro.codigo).toBe("conflito");
    if (!r.ok) expect((r.erro.atual as PedidoDeTransferencia).situacao).toBe("em_conferencia");
  });

  it("a mesma chave de envio do receber devolve o mesmo resultado", async () => {
    const ctx = contexto();
    const entrada = {
      placa: foraDoPatio.placa,
      pedidoId: "ped-1",
      versaoDoPedido: 1,
      conferido: true,
    };
    const primeira = await executarReceber(CHAVE_A, entrada, ctx);
    expect(await executarReceber(CHAVE_A, entrada, ctx)).toEqual(primeira);
  });

  it("quem não é o destinatário não recebe (sem_permissao)", async () => {
    const r = await executarReceber(
      CHAVE_A,
      { placa: foraDoPatio.placa, pedidoId: "ped-1", versaoDoPedido: 1, conferido: true },
      contexto(undefined, "gestor-3"),
    );
    expect(!r.ok && r.erro.codigo).toBe("sem_permissao");
  });

  it("concluir sem nota na pendência não resolvida é recusado pelo esquema", async () => {
    const r = await executarConcluirRecebimento(
      CHAVE_A,
      {
        placa: foraDoPatio.placa,
        pedidoId: "ped-1",
        versaoDoPedido: 2,
        pendencias: [{ id: "p1", resolvida: false, nota: "" }],
      },
      contexto(),
    );
    expect(!r.ok && r.erro.campos?.["pendencias.0.nota"]).toBeTruthy();
  });
});

describe("executarCriarItemDeCatalogo", () => {
  it("cria o item e o devolve", async () => {
    const ctx = contexto();
    const r = await executarCriarItemDeCatalogo(CHAVE_A, { tipo: "marca", nome: "DAF" }, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.linha).toMatchObject({ tipo: "marca", nome: "DAF" });
  });
  it("o CR pede o CODCENCUS", async () => {
    const ctx = contexto();
    const sem = await executarCriarItemDeCatalogo(CHAVE_A, { tipo: "cr", nome: "CR-9" }, ctx);
    expect(!sem.ok && sem.erro.campos?.codcencus).toBeTruthy();
    const com = await executarCriarItemDeCatalogo(
      CHAVE_B,
      { tipo: "cr", nome: "CR-9", codcencus: 2010101 },
      ctx,
    );
    expect(com.ok).toBe(true);
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
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const quebrada = new Proxy({} as FonteDeEscrita, {
      get: () => () => Promise.reject(new Error("banco fora do ar")),
    });
    const ctx = contexto(quebrada);
    const r = await executarCadastrarPlaca(CHAVE_A, cadastro(), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro.codigo).toBe("falha");
      expect(r.erro.mensagem).toMatch(/Tente de novo/);
      expect(r.erro.mensagem).not.toMatch(/banco fora do ar/);
    }
  });
});

describe("executarCancelarPedido e executarDevolverPlaca", () => {
  const alvo = (parcial: Record<string, unknown> = {}) => ({
    placa: foraDoPatio.placa,
    pedidoId: "ped-1",
    versaoDoPedido: 1,
    ...parcial,
  });

  it("a origem cancela o pedido pendente; o destino não", async () => {
    const doDestino = await executarCancelarPedido(CHAVE_A, alvo({ confirmado: true }), contexto());
    expect(doDestino.ok).toBe(false);
    if (!doDestino.ok) expect(doDestino.erro.codigo).toBe("sem_permissao");
    const ctx = contexto(undefined, "gestor-1");
    const r = await executarCancelarPedido(CHAVE_A, alvo({ confirmado: true }), ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.linha.situacao).toBe("cancelado");
    expect(await ctx.fonte.pedidoAbertoDa(foraDoPatio.placa)).toBeNull();
  });

  it("cancelar sem confirmar é recusado pelo esquema", async () => {
    const r = await executarCancelarPedido(
      CHAVE_A,
      alvo({ confirmado: false }),
      contexto(undefined, "gestor-1"),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("entrada_invalida");
  });

  it("o destino devolve o pedido recebido, com motivo; a placa fica com a origem", async () => {
    const ctx = contexto();
    const pendente = await executarDevolverPlaca(CHAVE_A, alvo({ motivo: "Avaria" }), ctx);
    expect(pendente.ok).toBe(false);
    const recebido = await executarReceber(CHAVE_B, alvo({ conferido: true }), ctx);
    expect(recebido.ok).toBe(true);
    const r = await executarDevolverPlaca(
      "33333333-3333-4333-8333-333333333333",
      alvo({ versaoDoPedido: 2, motivo: "Avaria" }),
      ctx,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.linha.situacao).toBe("devolvido");
    const placa = await ctx.fonte.placaParaAssistente(foraDoPatio.placa);
    expect(placa?.gestor).toBe(foraDoPatio.gestor);
  });
});
