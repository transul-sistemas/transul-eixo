import { describe, expect, it } from "vitest";
import type { ResultadoDaAcao } from "@/lib/wizard/resultado";
import type { PedidoDeTransferencia } from "./custodia";
import {
  type ChamadasDoLote,
  crsVigentesEm,
  decisoesPermitidas,
  etapasDaDecisao,
  executarLote,
  type ItemDoLote,
  diasDesdeOEnvio,
  situacaoDoEnvio,
  podeDecidirNoLote,
  precisaRegistrarSemCr,
  NOTA_DA_PENDENCIA,
  problemasDoLote,
  resumoDoLote,
} from "./meu-dia";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let n = 0;
const chave = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function pedido(id: string, extra: Partial<PedidoDeTransferencia> = {}): PedidoDeTransferencia {
  return {
    id,
    placa: `ZDM${id}`,
    deGestorId: "g1",
    deGestor: "Gestor Um",
    paraGestorId: "g2",
    paraGestor: "Gestor Dois",
    motivo: "troca de carteira",
    pendenciasConhecidas: [],
    situacao: "pendente",
    versao: 1,
    ...extra,
  };
}
const item = (
  p: PedidoDeTransferencia,
  decisao: ItemDoLote["decisao"],
  motivo = "",
): ItemDoLote => ({ pedido: p, decisao, motivo });

describe("decisoesPermitidas", () => {
  it("sem pendências: aceitar e recusar", () => {
    expect(decisoesPermitidas(pedido("1"))).toEqual(["aceitar", "recusar"]);
  });
  it("com pendências: aceitar com pendências e recusar (aceitar limpo não vale)", () => {
    const p = pedido("1", { pendenciasConhecidas: [{ id: "a", texto: "RENAVAM" }] });
    expect(decisoesPermitidas(p)).toEqual(["aceitar_com_pendencias", "recusar"]);
  });
  it("pedido que já não está aberto não tem decisão", () => {
    expect(decisoesPermitidas(pedido("1", { situacao: "concluido" }))).toEqual([]);
  });
});

describe("etapasDaDecisao", () => {
  it("pendente: receber e depois concluir ou devolver", () => {
    expect(etapasDaDecisao(pedido("1"), "aceitar")).toEqual(["receber", "concluir"]);
    expect(etapasDaDecisao(pedido("1"), "recusar")).toEqual(["receber", "devolver"]);
  });
  it("em conferência: a chegada já foi registrada, pula o receber", () => {
    const p = pedido("1", { situacao: "em_conferencia" });
    expect(etapasDaDecisao(p, "aceitar_com_pendencias")).toEqual(["concluir"]);
    expect(etapasDaDecisao(p, "recusar")).toEqual(["devolver"]);
  });
});

describe("problemasDoLote", () => {
  it("pede decisão para toda placa", () => {
    const r = problemasDoLote([item(pedido("1"), null)]);
    expect(r).toHaveLength(1);
    expect(r[0]?.pedidoId).toBe("1");
  });
  it("recusar exige motivo; só espaços não vale; 301 caracteres não vale", () => {
    expect(problemasDoLote([item(pedido("1"), "recusar", "  ")])).toHaveLength(1);
    expect(problemasDoLote([item(pedido("1"), "recusar", "x".repeat(301))])).toHaveLength(1);
    expect(problemasDoLote([item(pedido("1"), "recusar", "x".repeat(300))])).toEqual([]);
  });
  it("recusa decisão que o pedido não permite", () => {
    const p = pedido("1", { pendenciasConhecidas: [{ id: "a", texto: "RENAVAM" }] });
    expect(problemasDoLote([item(p, "aceitar")])).toHaveLength(1);
  });
  it("lote vazio não tem o que confirmar", () => {
    expect(problemasDoLote([])).toHaveLength(1);
  });
});

describe("crsVigentesEm", () => {
  const crs = [
    { codigo: "CR010", nome: "Op A", inicio: "2026-01-01", fim: "2026-06-01" },
    { codigo: "CR011", nome: "Op B", inicio: "2026-06-01", fim: null },
    { codigo: "CR900", nome: "Acionista", inicio: "2026-06-01", fim: null },
  ];
  it("o fim não conta e o início conta (intervalo [início, fim))", () => {
    expect(crsVigentesEm(crs, "2026-06-01").map((c) => c.codigo)).toEqual(["CR011", "CR900"]);
    expect(crsVigentesEm(crs, "2026-05-31").map((c) => c.codigo)).toEqual(["CR010"]);
  });
  it("sem CR vigente devolve lista vazia (nunca inventa)", () => {
    expect(crsVigentesEm(crs, "2025-12-31")).toEqual([]);
  });
});

function chamadasFalsas(falhas: Record<string, string> = {}) {
  const ligacoes: string[] = [];
  const fazer =
    (etapa: string) => async (entrada: { pedidoId: string; versaoDoPedido: number }, c: string) => {
      ligacoes.push(`${etapa}:${entrada.pedidoId}:v${entrada.versaoDoPedido}:${c}`);
      const falha = falhas[`${etapa}:${entrada.pedidoId}`];
      if (falha) {
        return {
          ok: false,
          erro: { codigo: "falha", mensagem: falha },
        } as ResultadoDaAcao<PedidoDeTransferencia>;
      }
      return {
        ok: true,
        linha: pedido(entrada.pedidoId, {
          versao: entrada.versaoDoPedido + 1,
          situacao: etapa === "receber" ? "em_conferencia" : "concluido",
        }),
      } as ResultadoDaAcao<PedidoDeTransferencia>;
    };
  const chamadas: ChamadasDoLote = {
    receber: fazer("receber"),
    concluir: fazer("concluir"),
    devolver: fazer("devolver"),
    registrarSemCr: fazer("registrar_sem_cr") as ChamadasDoLote["registrarSemCr"],
  };
  return { chamadas, ligacoes };
}
const chaveDe = (ligacao: string | undefined) => ligacao?.split(":").slice(3).join(":");

describe("executarLote", () => {
  it("cada placa é um pedido independente: uma falha não derruba as outras", async () => {
    const { chamadas } = chamadasFalsas({
      "receber:2": "O pedido já foi concluído por outra pessoa.",
    });
    const r = await executarLote(
      [
        item(pedido("1"), "aceitar"),
        item(pedido("2"), "aceitar"),
        item(pedido("3"), "recusar", "sem espaço"),
      ],
      chamadas,
      new Map(),
      chave,
    );
    expect(r.map((x) => x.situacao)).toEqual(["feita", "falhou", "feita"]);
    expect(r[1]?.erro).toBe("O pedido já foi concluído por outra pessoa.");
    expect(resumoDoLote(r)).toMatchObject({ total: 3, feitas: 2, falhas: 1 });
  });

  it("usa a versão que o receber devolveu no concluir", async () => {
    const { chamadas, ligacoes } = chamadasFalsas();
    await executarLote([item(pedido("1"), "aceitar")], chamadas, new Map(), chave);
    expect(ligacoes[0]).toMatch(/^receber:1:v1:/);
    expect(ligacoes[1]).toMatch(/^concluir:1:v2:/);
  });

  it("as chaves de envio são UUID", async () => {
    const { chamadas, ligacoes } = chamadasFalsas();
    await executarLote([item(pedido("1"), "recusar", "motivo")], chamadas, new Map(), chave);
    for (const l of ligacoes) expect(chaveDe(l)).toMatch(UUID);
  });

  it("aceitar com pendências: cada pendência vai como não resolvida, com nota", async () => {
    let enviado: unknown;
    const { chamadas } = chamadasFalsas();
    const p = pedido("1", {
      pendenciasConhecidas: [
        { id: "a", texto: "RENAVAM" },
        { id: "b", texto: "Carroceria" },
      ],
    });
    await executarLote(
      [item(p, "aceitar_com_pendencias")],
      {
        ...chamadas,
        concluir: async (entrada, c) => {
          enviado = entrada;
          return chamadas.concluir(entrada, c);
        },
      },
      new Map(),
      chave,
    );
    expect(enviado).toMatchObject({
      pendencias: [
        { id: "a", resolvida: false, nota: NOTA_DA_PENDENCIA },
        { id: "b", resolvida: false, nota: NOTA_DA_PENDENCIA },
      ],
    });
  });

  it("recusar manda o motivo aparado", async () => {
    let enviado: unknown;
    const { chamadas } = chamadasFalsas();
    await executarLote(
      [item(pedido("1"), "recusar", "  placa errada  ")],
      {
        ...chamadas,
        devolver: async (entrada, c) => {
          enviado = entrada;
          return chamadas.devolver(entrada, c);
        },
      },
      new Map(),
      chave,
    );
    expect(enviado).toMatchObject({ motivo: "placa errada" });
  });

  it("repetir não duplica: o feito não é chamado de novo e a falha reusa a mesma chave", async () => {
    const progresso = new Map();
    const primeira = chamadasFalsas({ "concluir:2": "fora do ar" });
    const lote = [item(pedido("1"), "aceitar"), item(pedido("2"), "aceitar")];
    const r1 = await executarLote(lote, primeira.chamadas, progresso, chave);
    expect(r1.map((x) => x.situacao)).toEqual(["feita", "falhou"]);
    const chaveDoConcluir2 = chaveDe(primeira.ligacoes.find((l) => l.startsWith("concluir:2")));

    const segunda = chamadasFalsas();
    const r2 = await executarLote(lote, segunda.chamadas, progresso, chave);
    expect(r2.map((x) => x.situacao)).toEqual(["feita", "feita"]);
    // a placa 1 não foi tocada; a 2 retoma do concluir (o receber já valeu), com a mesma chave
    expect(segunda.ligacoes).toHaveLength(1);
    expect(segunda.ligacoes[0]).toMatch(/^concluir:2:v2:/);
    expect(chaveDe(segunda.ligacoes[0])).toBe(chaveDoConcluir2);
  });

  it("um erro lançado vira falha daquela placa e o lote segue", async () => {
    const { chamadas } = chamadasFalsas();
    const r = await executarLote(
      [item(pedido("1"), "aceitar"), item(pedido("2"), "aceitar")],
      {
        ...chamadas,
        receber: async (e, c) => {
          if (e.pedidoId === "1") throw new Error("rede");
          return chamadas.receber(e, c);
        },
      },
      new Map(),
      chave,
    );
    expect(r.map((x) => x.situacao)).toEqual(["falhou", "feita"]);
    expect(r[0]?.erro).toMatch(/Tente de novo/);
  });
});

describe("resumoDoLote", () => {
  it("conta aceitas, com pendências e recusadas, e o X de Y", () => {
    const resumo = resumoDoLote([
      { pedidoId: "1", placa: "A", decisao: "aceitar", situacao: "feita" },
      { pedidoId: "2", placa: "B", decisao: "aceitar", situacao: "feita" },
      { pedidoId: "3", placa: "C", decisao: "aceitar_com_pendencias", situacao: "feita" },
      { pedidoId: "4", placa: "D", decisao: "recusar", situacao: "feita" },
      { pedidoId: "5", placa: "E", decisao: "recusar", situacao: "falhou", erro: "x" },
    ]);
    expect(resumo).toMatchObject({
      total: 5,
      feitas: 4,
      falhas: 1,
      aceitas: 2,
      comPendencias: 1,
      recusadas: 1,
    });
    expect(resumo.texto).toBe(
      "4 de 5 decisões gravadas: 2 aceitas, 1 com pendências, 1 recusada. 1 não foi gravada.",
    );
  });
  it("tudo certo não fala de falha", () => {
    const r = resumoDoLote([{ pedidoId: "1", placa: "A", decisao: "aceitar", situacao: "feita" }]);
    expect(r.texto).toBe("1 de 1 decisão gravada: 1 aceita.");
  });
});

describe("diasDesdeOEnvio (dia de São Paulo, -03:00)", () => {
  it("conta dias de calendário até hoje", () => {
    expect(diasDesdeOEnvio("2026-11-04T15:30:00Z", "2026-11-12")).toBe(8);
    expect(diasDesdeOEnvio("2026-11-11T15:30:00Z", "2026-11-12")).toBe(1);
  });
  it("o mesmo dia é zero, mesmo sendo às 23h59 de São Paulo (02:59Z do dia seguinte)", () => {
    expect(diasDesdeOEnvio("2026-11-12T02:59:00Z", "2026-11-11")).toBe(0);
    expect(diasDesdeOEnvio("2026-11-12T03:00:00Z", "2026-11-12")).toBe(0);
  });
  it("passa a virada do mês e do ano", () => {
    expect(diasDesdeOEnvio("2026-10-30T15:00:00Z", "2026-11-02")).toBe(3);
    expect(diasDesdeOEnvio("2026-12-30T15:00:00Z", "2027-01-02")).toBe(3);
  });
  it("envio no futuro (relógio diferente) nunca dá negativo", () => {
    expect(diasDesdeOEnvio("2026-11-13T15:00:00Z", "2026-11-12")).toBe(0);
  });
});

describe("situacaoDoEnvio", () => {
  it("fala 'há N dias', 'há 1 dia' e 'hoje'", () => {
    expect(situacaoDoEnvio("2026-11-04T15:30:00Z", "2026-11-12", 5).rotulo).toBe("há 8 dias");
    expect(situacaoDoEnvio("2026-11-11T15:30:00Z", "2026-11-12", 5).rotulo).toBe("há 1 dia");
    expect(situacaoDoEnvio("2026-11-12T15:30:00Z", "2026-11-12", 5).rotulo).toBe("hoje");
  });
  it("vence só depois do prazo: no limite ainda está no prazo", () => {
    expect(situacaoDoEnvio("2026-11-07T15:00:00Z", "2026-11-12", 5).vencido).toBe(false); // 5 dias
    expect(situacaoDoEnvio("2026-11-06T15:00:00Z", "2026-11-12", 5).vencido).toBe(true); // 6 dias
    expect(situacaoDoEnvio("2026-11-12T15:00:00Z", "2026-11-12", 5).vencido).toBe(false);
  });
  it("o vencido leva texto próprio (nunca só a cor)", () => {
    expect(situacaoDoEnvio("2026-11-04T15:30:00Z", "2026-11-12", 5).aviso).toBe("Prazo vencido");
    expect(situacaoDoEnvio("2026-11-11T15:30:00Z", "2026-11-12", 5).aviso).toBeNull();
  });
  it("sem data de envio ou sem prazo, não inventa: sem rótulo e sem vencimento", () => {
    expect(situacaoDoEnvio(null, "2026-11-12", 5)).toEqual({
      rotulo: null,
      vencido: false,
      aviso: null,
    });
    expect(situacaoDoEnvio("2026-11-01T15:30:00Z", "2026-11-12", null)).toMatchObject({
      rotulo: "há 11 dias",
      vencido: false,
      aviso: null,
    });
  });
});

describe("quem decide o lote", () => {
  it("só o gestor de destino decide; o Administrador só lê", () => {
    expect(podeDecidirNoLote("Gestor de frota")).toBe(true);
    expect(podeDecidirNoLote("Administrador")).toBe(false);
    expect(podeDecidirNoLote("Diretoria")).toBe(false);
    expect(podeDecidirNoLote("Operacional")).toBe(false);
  });
});

describe("precisaRegistrarSemCr", () => {
  it("só ao aceitar (limpo ou com pendências) uma placa sem CR vigente", () => {
    expect(precisaRegistrarSemCr("aceitar", [])).toBe(true);
    expect(precisaRegistrarSemCr("aceitar_com_pendencias", [])).toBe(true);
    expect(precisaRegistrarSemCr("recusar", [])).toBe(false);
    expect(precisaRegistrarSemCr("aceitar", [{ codigo: "CR1" }])).toBe(false);
  });
  it("CR não lido (null) não é 'sem CR': o banco confere de novo por dentro", () => {
    expect(precisaRegistrarSemCr("aceitar", null)).toBe(true);
  });
});

describe("executarLote: placa aceita sem CR vigente", () => {
  const semCr = (p: PedidoDeTransferencia, d: ItemDoLote["decisao"]): ItemDoLote => ({
    ...item(p, d, d === "recusar" ? "motivo" : ""),
    crs: [],
  });
  const comCr = (p: PedidoDeTransferencia, d: ItemDoLote["decisao"]): ItemDoLote => ({
    ...item(p, d),
    crs: [{ codigo: "CR1", nome: "x" }],
  });

  it("aceitar sem CR registra a exceção depois de concluir; aceitar com pendências também", async () => {
    const { chamadas, ligacoes } = chamadasFalsas();
    await executarLote(
      [
        semCr(pedido("1"), "aceitar"),
        semCr(
          pedido("2", { pendenciasConhecidas: [{ id: "p", texto: "t" }] }),
          "aceitar_com_pendencias",
        ),
      ],
      chamadas,
      new Map(),
      chave,
    );
    expect(ligacoes.map((l) => l.split(":").slice(0, 2).join(":"))).toEqual([
      "receber:1",
      "concluir:1",
      "registrar_sem_cr:1",
      "receber:2",
      "concluir:2",
      "registrar_sem_cr:2",
    ]);
  });

  it("recusar ou ter CR vigente não registra", async () => {
    const { chamadas, ligacoes } = chamadasFalsas();
    await executarLote(
      [semCr(pedido("1"), "recusar"), comCr(pedido("2"), "aceitar")],
      chamadas,
      new Map(),
      chave,
    );
    expect(ligacoes.some((l) => l.startsWith("registrar_sem_cr"))).toBe(false);
  });

  it("falha ao registrar não desfaz o aceite: 'Tentar de novo' repete só o registro, com a mesma chave", async () => {
    const falhas = { "registrar_sem_cr:1": "Sem conexão. Tente de novo." };
    const { chamadas, ligacoes } = chamadasFalsas(falhas);
    const progresso = new Map();
    const itens = [semCr(pedido("1"), "aceitar")];
    const r1 = await executarLote(itens, chamadas, progresso, chave);
    expect(r1[0]?.situacao).toBe("falhou");
    delete (falhas as Record<string, string>)["registrar_sem_cr:1"];
    const r2 = await executarLote(itens, chamadas, progresso, chave);
    expect(r2[0]?.situacao).toBe("feita");
    const tipos = ligacoes.map((l) => l.split(":")[0]);
    expect(tipos).toEqual(["receber", "concluir", "registrar_sem_cr", "registrar_sem_cr"]);
    const chaves = ligacoes.filter((l) => l.startsWith("registrar_sem_cr")).map((l) => chaveDe(l));
    expect(chaves[0]).toBe(chaves[1]);
  });

  it("sem a chamada registrada (outras telas), nada muda", async () => {
    const { chamadas, ligacoes } = chamadasFalsas();
    delete chamadas.registrarSemCr;
    await executarLote([semCr(pedido("1"), "aceitar")], chamadas, new Map(), chave);
    expect(ligacoes.map((l) => l.split(":")[0])).toEqual(["receber", "concluir"]);
  });
});
