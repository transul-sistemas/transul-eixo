import { beforeEach, describe, expect, it, vi } from "vitest";
import { podeEntregar, type PedidoDeTransferencia } from "@/lib/dominio/custodia";
import { escritaDoArmazem } from "@/lib/dados/fonte-de-exemplo";
import { criarArmazem, type Armazem } from "@/lib/exemplo/armazem";
import { placasDeExemplo } from "@/lib/exemplo/placas";
import type { Perfil } from "@/lib/navegacao/perfis";

// As Server Actions de escrita da Frota: permissão, entrada, gravação pela fonte e invalidação do cache.

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  perfil: { atual: "Administrador" as string },
  fonte: { atual: null as unknown },
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
// A sessão simulada: o perfil decide pela tabela de permissões do seed (o espelho), como o banco faria.
vi.mock("@/lib/seguranca/exigir-permissao", async (original) => {
  const real = await original<typeof import("@/lib/seguranca/exigir-permissao")>();
  return {
    ...real,
    exigirPermissao: async (permissao: Parameters<typeof real.exigirPermissao>[0]) => {
      if (!real.temPermissao(mocks.perfil.atual as Perfil, permissao)) {
        throw new real.ErroDePermissao(permissao.modulo, permissao.acao);
      }
    },
  };
});
vi.mock("@/lib/dados/fonte", async (original) => {
  const real = await original<typeof import("@/lib/dados/fonte")>();
  return { ...real, fonteDeEscrita: async () => mocks.fonte.atual };
});
// O gestor de quem grava (no exemplo, o de destino do pedido de transferência de exemplo).
vi.mock("@/lib/seguranca/gestor-atual", () => ({ gestorAtual: async () => "gestor-2" }));

import {
  cadastrarPlacaAcao,
  concluirRecebimentoAcao,
  devolverPlacaAcao,
  cancelarPedidoAcao,
  criarItemDeCatalogoAcao,
  disponibilizarPlacaAcao,
  entregarAoOperacionalAcao,
  receberPlacaAcao,
} from "./acoes";

const HOJE_REAL = new Date().toISOString().slice(0, 10);
const base = placasDeExemplo(HOJE_REAL);
const emOrigem = (sigla: string) => ["PÁT", "ETv"].includes(sigla);
const noPatio = base.find((p) => podeEntregar(p.sigla, p.tipo))!;
const foraDoPatio = base.find((p) => !emOrigem(p.sigla) && p.sigla !== "VND" && p.sigla !== "SUC")!;
const CHAVE = "11111111-1111-4111-8111-111111111111";
const OUTRA = "33333333-3333-4333-8333-333333333333";
const pedido: PedidoDeTransferencia = {
  id: "ped-1",
  placa: foraDoPatio.placa,
  deGestorId: "gestor-1",
  deGestor: "Gestor Exemplo 1",
  paraGestorId: "gestor-2", // o gestor de quem grava
  paraGestor: "Gestor Exemplo 2",
  motivo: "Troca de carteira",
  pendenciasConhecidas: [{ id: "p1", texto: "CRLV vencendo" }],
  situacao: "pendente",
  versao: 1,
};

const cadastro = {
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
};

let armazemAtual: Armazem;
const armazem = () => armazemAtual;
beforeEach(() => {
  mocks.revalidatePath.mockClear();
  mocks.perfil.atual = "Administrador";
  armazemAtual = criarArmazem({ placasBase: base, pedidosBase: [pedido] });
  mocks.fonte.atual = escritaDoArmazem(armazemAtual);
});

describe("cadastrarPlacaAcao", () => {
  it("grava, devolve a linha e invalida a lista e a ficha da placa", async () => {
    const r = await cadastrarPlacaAcao({ chaveDeEnvio: CHAVE, dados: cadastro });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.linha.placa).toBe("ZZZ9Z99");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/frota/placas");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/frota/placas/ZZZ9Z99");
  });

  it("Operacional não cadastra: sem_permissao, nada é gravado e o cache não é tocado", async () => {
    mocks.perfil.atual = "Operacional";
    const r = await cadastrarPlacaAcao({ chaveDeEnvio: CHAVE, dados: cadastro });
    expect(!r.ok && r.erro.codigo).toBe("sem_permissao");
    expect(armazem().placasCadastradas()).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("Gestor de frota, Administrador e Diretoria podem", async () => {
    for (const [i, perfil] of (
      ["Gestor de frota", "Administrador", "Diretoria"] as const
    ).entries()) {
      mocks.perfil.atual = perfil;
      const r = await cadastrarPlacaAcao({
        chaveDeEnvio: `2222222${i}-2222-4222-8222-222222222222`,
        dados: { ...cadastro, placa: `ZZZ9Z9${i}` },
      });
      expect(r.ok, perfil).toBe(true);
    }
  });

  it("entrada que não é um envio vira entrada_invalida, sem lançar nem invalidar", async () => {
    for (const lixo of [null, undefined, 5, "x", [], {}, { dados: cadastro }]) {
      const r = await cadastrarPlacaAcao(lixo);
      expect(!r.ok && r.erro.codigo, String(lixo)).toBe("entrada_invalida");
    }
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("o mesmo envio repetido (clique duplo) grava uma vez só", async () => {
    await cadastrarPlacaAcao({ chaveDeEnvio: CHAVE, dados: cadastro });
    const segunda = await cadastrarPlacaAcao({ chaveDeEnvio: CHAVE, dados: cadastro });
    expect(segunda.ok).toBe(true);
    expect(armazem().placasCadastradas()).toHaveLength(1);
  });
});

describe("entregarAoOperacionalAcao", () => {
  const envio = (parcial: Record<string, unknown> = {}, chaveDeEnvio = CHAVE) => ({
    chaveDeEnvio,
    dados: { placa: noPatio.placa, filialId: "filial-b", versaoDaPlaca: 1, ...parcial },
  });
  it("leva a placa a DOp e invalida a lista e a ficha", async () => {
    const r = await entregarAoOperacionalAcao(envio());
    expect(r.ok && r.linha.sigla).toBe("DOp");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/frota/placas/${noPatio.placa}`);
  });
  it("Operacional não entrega", async () => {
    mocks.perfil.atual = "Operacional";
    const r = await entregarAoOperacionalAcao(envio());
    expect(!r.ok && r.erro.codigo).toBe("sem_permissao");
  });
  it("conflito (versão velha) devolve a placa atual e não invalida o cache", async () => {
    await entregarAoOperacionalAcao(envio());
    mocks.revalidatePath.mockClear();
    const r = await entregarAoOperacionalAcao(envio({ filialId: "filial-c" }, OUTRA));
    expect(!r.ok && r.erro.codigo).toBe("conflito");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("disponibilizarPlacaAcao, receberPlacaAcao e concluirRecebimentoAcao", () => {
  it("disponibilizar abre o pedido e invalida também o selo do menu (layout)", async () => {
    const r = await disponibilizarPlacaAcao({
      chaveDeEnvio: CHAVE,
      dados: {
        placa: noPatio.placa,
        paraGestorId: "gestor-6",
        motivo: "Troca de carteira",
        pendenciasConhecidas: [],
        versaoDaPlaca: 1,
      },
    });
    expect(r.ok && r.linha.situacao).toBe("pendente");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("receber e concluir como o gestor de destino; o gestor da placa troca só ao concluir", async () => {
    const recebido = await receberPlacaAcao({
      chaveDeEnvio: CHAVE,
      dados: { placa: foraDoPatio.placa, pedidoId: "ped-1", versaoDoPedido: 1, conferido: true },
    });
    expect(recebido.ok && recebido.linha.situacao).toBe("em_conferencia");
    const concluido = await concluirRecebimentoAcao({
      chaveDeEnvio: OUTRA,
      dados: {
        placa: foraDoPatio.placa,
        pedidoId: "ped-1",
        versaoDoPedido: 2,
        pendencias: [{ id: "p1", resolvida: true, nota: "" }],
      },
    });
    expect(concluido.ok && concluido.linha.gestor).toBe("Gestor Exemplo 2");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/frota/placas/${foraDoPatio.placa}`);
  });
  it("Operacional não disponibiliza, não recebe e não conclui", async () => {
    mocks.perfil.atual = "Operacional";
    const r = await receberPlacaAcao({
      chaveDeEnvio: CHAVE,
      dados: { placa: foraDoPatio.placa, pedidoId: "ped-1", versaoDoPedido: 1, conferido: true },
    });
    expect(!r.ok && r.erro.codigo).toBe("sem_permissao");
    expect(armazem().pedidoAbertoDa(foraDoPatio.placa)?.situacao).toBe("pendente");
  });
});

describe("criarItemDeCatalogoAcao", () => {
  it("cria o item e invalida a lista (os assistentes leem o catálogo de lá)", async () => {
    const r = await criarItemDeCatalogoAcao({
      chaveDeEnvio: CHAVE,
      dados: { tipo: "marca", nome: "DAF" },
    });
    expect(r.ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/frota/placas");
  });
  it("Operacional não cria itens de catálogo da Frota", async () => {
    mocks.perfil.atual = "Operacional";
    const r = await criarItemDeCatalogoAcao({
      chaveDeEnvio: CHAVE,
      dados: { tipo: "marca", nome: "DAF" },
    });
    expect(!r.ok && r.erro.codigo).toBe("sem_permissao");
  });
});

describe("cancelarPedidoAcao e devolverPlacaAcao", () => {
  const alvo = { placa: foraDoPatio.placa, pedidoId: "ped-1", versaoDoPedido: 1 };

  it("Operacional não cancela nem devolve: sem_permissao, sem tocar o cache", async () => {
    mocks.perfil.atual = "Operacional";
    const a = await cancelarPedidoAcao({
      chaveDeEnvio: CHAVE,
      dados: { ...alvo, confirmado: true },
    });
    const b = await devolverPlacaAcao({
      chaveDeEnvio: OUTRA,
      dados: { ...alvo, motivo: "Avaria" },
    });
    expect(!a.ok && a.erro.codigo).toBe("sem_permissao");
    expect(!b.ok && b.erro.codigo).toBe("sem_permissao");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("o destino devolve o pedido recebido e invalida a ficha e o menu", async () => {
    await receberPlacaAcao({ chaveDeEnvio: CHAVE, dados: { ...alvo, conferido: true } });
    mocks.revalidatePath.mockClear();
    const r = await devolverPlacaAcao({
      chaveDeEnvio: OUTRA,
      dados: { ...alvo, versaoDoPedido: 2, motivo: "Avaria" },
    });
    expect(r.ok && r.linha.situacao).toBe("devolvido");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/frota/placas/${foraDoPatio.placa}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});
