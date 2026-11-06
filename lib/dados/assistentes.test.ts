import { describe, expect, it } from "vitest";
import {
  podeEntregar,
  SIGLAS_QUE_PODEM_ENTREGAR,
  type PedidoDeTransferencia,
} from "@/lib/dominio/custodia";
import { criarArmazem } from "@/lib/exemplo/armazem";
import { placasDeExemplo } from "@/lib/exemplo/placas";
import { dadosDosAssistentes } from "./assistentes";
import { escritaDoArmazem } from "./fonte-de-exemplo";

const HOJE = "2026-10-31";
const base = placasDeExemplo(HOJE);
const emOrigem = (sigla: string) =>
  (SIGLAS_QUE_PODEM_ENTREGAR as readonly string[]).includes(sigla);
const noPatio = base.find((p) => podeEntregar(p.sigla, p.tipo))!;
const comPedido = base.find(
  (p) => !emOrigem(p.sigla) && p.tipo === "cavalo" && p.sigla !== "VND" && p.sigla !== "SUC",
)!;
const recebida = base.find(
  (p) =>
    p.placa !== comPedido.placa && p.tipo === "cavalo" && p.sigla !== "VND" && p.sigla !== "SUC",
)!;
const pedido = (
  placa: string,
  parcial: Partial<PedidoDeTransferencia> = {},
): PedidoDeTransferencia => ({
  id: `ped-${placa}`,
  placa,
  deGestorId: "gestor-1",
  deGestor: "Gestor Exemplo 1",
  paraGestorId: "gestor-2",
  paraGestor: "Gestor Exemplo 2",
  motivo: "Troca de carteira",
  pendenciasConhecidas: [{ id: "p1", texto: "CRLV vencendo" }],
  situacao: "pendente",
  versao: 1,
  ...parcial,
});
const fonte = () =>
  escritaDoArmazem(
    criarArmazem({
      placasBase: base,
      pedidosBase: [
        pedido(comPedido.placa),
        pedido(recebida.placa, { situacao: "em_conferencia", versao: 2 }),
      ],
    }),
  );
const comum = { hoje: HOJE, usuario: "u-1", gestorId: "gestor-2" };

describe("dadosDosAssistentes: o que a tela entrega ao assistente", () => {
  it("sempre traz o dia, o ano, os catálogos e o que o + cria", async () => {
    const d = await dadosDosAssistentes(fonte(), { ...comum, assistente: null, placa: null });
    expect(d.hoje).toBe(HOJE);
    expect(d.anoAtual).toBe(2026);
    expect(d.catalogos.carrocerias.length).toBeGreaterThan(0);
    expect(d.criaveis).toContain("cr");
    expect(d.placaAlvo).toBeNull();
    expect(d.pedido).toBeNull();
    expect(d.placasParaReceber).toEqual([]);
    expect(d.placasParaEntregar).toEqual([]);
  });

  it("para receber sem placa, lista só os pedidos pendentes para quem usa", async () => {
    const d = await dadosDosAssistentes(fonte(), {
      ...comum,
      assistente: "receber-placa",
      placa: null,
    });
    expect(d.placasParaReceber.map((p) => p.placa)).toEqual([comPedido.placa]);
    expect(d.placasParaConcluir.map((p) => p.placa)).toEqual([recebida.placa]);
  });

  it("para concluir sem placa, lista só os pedidos já recebidos (em conferência)", async () => {
    const d = await dadosDosAssistentes(fonte(), {
      ...comum,
      assistente: "concluir-recebimento",
      placa: null,
    });
    expect(d.placasParaConcluir.map((p) => p.placa)).toEqual([recebida.placa]);
  });

  it("outro gestor não vê os pedidos que não são dele; sem gestor, nenhum", async () => {
    for (const gestorId of ["gestor-3", null]) {
      const d = await dadosDosAssistentes(fonte(), {
        ...comum,
        gestorId,
        assistente: "receber-placa",
        placa: null,
      });
      expect(d.placasParaReceber, String(gestorId)).toEqual([]);
    }
  });

  it("com a placa, traz a placa com a versão e o pedido aberto", async () => {
    const d = await dadosDosAssistentes(fonte(), {
      ...comum,
      assistente: "receber-placa",
      placa: comPedido.placa,
    });
    expect(d.placaAlvo?.placa).toBe(comPedido.placa);
    expect(d.placaAlvo?.versao).toBe(1);
    expect(d.pedido?.id).toBe(`ped-${comPedido.placa}`);
  });

  it("para entregar sem placa, lista só cavalos e caminhões em PÁT ou ETv, em ordem", async () => {
    const d = await dadosDosAssistentes(fonte(), {
      ...comum,
      assistente: "entregar-ao-operacional",
      placa: null,
    });
    const esperadas = base
      .filter((p) => podeEntregar(p.sigla, p.tipo))
      .map((p) => p.placa)
      .sort();
    expect(d.placasParaEntregar.map((p) => p.placa)).toEqual(esperadas);
    expect(d.placasParaEntregar.map((p) => p.placa)).toContain(noPatio.placa);
  });

  it("placa que não existe (ou mal escrita) fica sem alvo, sem lançar", async () => {
    for (const placa of ["ZZZ9Z99", "xx"]) {
      const d = await dadosDosAssistentes(fonte(), {
        ...comum,
        assistente: "disponibilizar-placa",
        placa,
      });
      expect(d.placaAlvo, placa).toBeNull();
    }
  });

  it("na ficha (carregarDaPlaca), a placa e o pedido vêm sem o assistente estar na URL", async () => {
    const d = await dadosDosAssistentes(fonte(), {
      ...comum,
      assistente: null,
      placa: comPedido.placa,
      carregarDaPlaca: true,
    });
    expect(d.placaAlvo?.placa).toBe(comPedido.placa);
    expect(d.pedido?.situacao).toBe("pendente");
  });

  it("leva o usuário da sessão para a chave dos rascunhos e o gestor de quem usa", async () => {
    const d = await dadosDosAssistentes(fonte(), { ...comum, assistente: null, placa: null });
    expect(d.usuario).toBe("u-1");
    expect(d.gestorId).toBe("gestor-2");
  });
});
