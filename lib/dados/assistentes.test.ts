import { describe, expect, it } from "vitest";
import {
  podeDisponibilizar,
  SIGLAS_QUE_PODEM_DISPONIBILIZAR,
  type PedidoDeTransferencia,
} from "@/lib/dominio/custodia";
import { criarArmazem } from "@/lib/exemplo/armazem";
import { placasDeExemplo } from "@/lib/exemplo/placas";
import { dadosDosAssistentes } from "./assistentes";
import { escritaDoArmazem } from "./fonte-de-exemplo";

const HOJE = "2026-10-31";
const base = placasDeExemplo(HOJE);
const emOrigem = (sigla: string) =>
  (SIGLAS_QUE_PODEM_DISPONIBILIZAR as readonly string[]).includes(sigla);
const noPatio = base.find((p) => podeDisponibilizar(p.sigla, p.tipo))!;
const carretaNoPatio = base.find((p) => p.tipo === "implemento" && emOrigem(p.sigla))!;
const comPedido = base.find(
  (p) => !emOrigem(p.sigla) && p.tipo === "cavalo" && p.sigla !== "VND" && p.sigla !== "SUC",
)!;
const pedido: PedidoDeTransferencia = {
  id: "ped-1",
  placa: comPedido.placa,
  deGestorId: "gestor-1",
  paraGestorId: "gestor-2",
  motivo: "Troca de carteira",
  pendenciasConhecidas: [{ id: "p1", texto: "CRLV vencendo" }],
  situacao: "pendente",
  versao: 1,
};
const fonte = () => escritaDoArmazem(criarArmazem({ placasBase: base, pedidosBase: [pedido] }));

describe("dadosDosAssistentes: o que a tela entrega ao assistente", () => {
  it("sempre traz o dia, o ano e os catálogos (o cadastrar e o + abrem sem esperar)", async () => {
    const d = await dadosDosAssistentes(fonte(), { hoje: HOJE, assistente: null, placa: null });
    expect(d.hoje).toBe(HOJE);
    expect(d.anoAtual).toBe(2026);
    expect(d.catalogos.marcas.length).toBeGreaterThan(0);
    expect(d.catalogos.garagens.length).toBeGreaterThan(0);
    expect(d.placaAlvo).toBeNull();
    expect(d.pedido).toBeNull();
    expect(d.candidatosDoConjunto).toEqual([]);
    expect(d.placasComPedido).toEqual([]);
    expect(d.placasParaDisponibilizar).toEqual([]);
  });

  it("para receber sem placa escolhida, lista as placas com pedido pendente", async () => {
    const d = await dadosDosAssistentes(fonte(), {
      hoje: HOJE,
      assistente: "receber-placa",
      placa: null,
    });
    expect(d.placasComPedido).toEqual([
      { placa: comPedido.placa, nome: `${comPedido.placa} · ${comPedido.modelo}` },
    ]);
    expect(d.placaAlvo).toBeNull();
  });

  it("para receber com a placa, traz a placa com a versão, o pedido e os candidatos do conjunto", async () => {
    const d = await dadosDosAssistentes(fonte(), {
      hoje: HOJE,
      assistente: "receber-placa",
      placa: comPedido.placa.toLowerCase(),
    });
    expect(d.placaAlvo).toMatchObject({ placa: comPedido.placa, versao: 1 });
    expect(d.pedido).toMatchObject({ id: "ped-1", motivo: "Troca de carteira" });
    expect(d.candidatosDoConjunto.length).toBeGreaterThan(0);
  });

  it("para disponibilizar sem placa, lista as placas em PÁT, VAz ou ETv, em ordem", async () => {
    const d = await dadosDosAssistentes(fonte(), {
      hoje: HOJE,
      assistente: "disponibilizar",
      placa: null,
    });
    expect(d.placasParaDisponibilizar.length).toBeGreaterThan(0);
    const placas = d.placasParaDisponibilizar.map((p) => p.placa);
    expect([...placas].sort()).toEqual(placas);
    expect(placas).toContain(noPatio.placa);
  });

  it("para disponibilizar sem placa, a carreta, o apoio e o equipamento nunca entram na lista (nem no Ctrl+K)", async () => {
    const d = await dadosDosAssistentes(fonte(), {
      hoje: HOJE,
      assistente: "disponibilizar",
      placa: null,
    });
    const placas = d.placasParaDisponibilizar.map((p) => p.placa);
    expect(placas).not.toContain(carretaNoPatio.placa);
    for (const p of base.filter((x) => x.tipo !== "cavalo" && x.tipo !== "caminhao")) {
      expect(placas, p.placa).not.toContain(p.placa);
    }
  });

  it("para disponibilizar sem placa, todo cavalo e caminhão em PÁT, VAz ou ETv aparece", async () => {
    const d = await dadosDosAssistentes(fonte(), {
      hoje: HOJE,
      assistente: "disponibilizar",
      placa: null,
    });
    const placas = new Set(d.placasParaDisponibilizar.map((p) => p.placa));
    for (const p of base.filter((x) => podeDisponibilizar(x.sigla, x.tipo))) {
      expect(placas.has(p.placa), p.placa).toBe(true);
    }
  });

  it("para disponibilizar com a placa, traz a placa com a versão", async () => {
    const d = await dadosDosAssistentes(fonte(), {
      hoje: HOJE,
      assistente: "disponibilizar",
      placa: noPatio.placa,
    });
    expect(d.placaAlvo).toMatchObject({ placa: noPatio.placa, versao: 1 });
  });

  it("placa que não existe (ou mal escrita) fica sem alvo, sem lançar", async () => {
    for (const placa of ["QQQ0Q00", "abc", "../x"]) {
      const d = await dadosDosAssistentes(fonte(), {
        hoje: HOJE,
        assistente: "disponibilizar",
        placa,
      });
      expect(d.placaAlvo, placa).toBeNull();
    }
  });

  it("na ficha (carregarDaPlaca), a placa, o pedido e os candidatos vêm sem o assistente estar na URL", async () => {
    const d = await dadosDosAssistentes(fonte(), {
      hoje: HOJE,
      assistente: null,
      placa: comPedido.placa,
      carregarDaPlaca: true,
    });
    expect(d.placaAlvo?.placa).toBe(comPedido.placa);
    expect(d.pedido?.id).toBe("ped-1");
    expect(d.candidatosDoConjunto.length).toBeGreaterThan(0);
  });

  it("os candidatos de equipamento, caminhão e apoio são vazios", async () => {
    const equipamento = base.find((p) => p.tipo === "equipamento")!;
    const d = await dadosDosAssistentes(fonte(), {
      hoje: HOJE,
      assistente: null,
      placa: equipamento.placa,
      carregarDaPlaca: true,
    });
    expect(d.candidatosDoConjunto).toEqual([]);
  });
});
