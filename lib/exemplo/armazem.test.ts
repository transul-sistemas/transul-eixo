import { describe, expect, it } from "vitest";
import { podeDisponibilizar, type PedidoDeTransferencia } from "@/lib/dominio/custodia";
import {
  esquemaCadastrarPlaca,
  type EntradaCadastrarPlaca,
  type EntradaDisponibilizacao,
  type EntradaRecebimento,
} from "@/lib/dominio/esquemas/placa";
import { armazemDoProcesso, criarArmazem, type Armazem } from "./armazem";
import { placasDeExemplo } from "./placas";

const HOJE = "2026-10-31";
const AGORA = "2026-10-31T09:30";
const DEPOIS = "2026-10-31T10:05";
const CHAVE_A = "11111111-1111-4111-8111-111111111111";
const CHAVE_B = "22222222-2222-4222-8222-222222222222";
const CHAVE_C = "33333333-3333-4333-8333-333333333333";

const base = placasDeExemplo(HOJE);
const noPatio = base.find((p) => podeDisponibilizar(p.sigla))!;
const foraDoPatio = base.find(
  (p) => !podeDisponibilizar(p.sigla) && p.sigla !== "VND" && p.sigla !== "SUC",
)!;

const pedidoBase = (placa: string): PedidoDeTransferencia => ({
  id: "ped-1",
  placa,
  deGestorId: "gestor-1",
  paraGestorId: "gestor-2",
  motivo: "Troca de carteira",
  pendenciasConhecidas: [{ id: "p1", texto: "CRLV vencendo" }],
  situacao: "pendente",
  versao: 1,
});

function novo(): Armazem {
  return criarArmazem({ placasBase: base, pedidosBase: [pedidoBase(foraDoPatio.placa)] });
}

const entradaDeCadastro = (parcial: Record<string, unknown> = {}): EntradaCadastrarPlaca => {
  const r = esquemaCadastrarPlaca({ anoAtual: 2026, hoje: HOJE }).safeParse({
    placa: "zzz-9z99",
    renavam: "00639884962",
    tipo: "cavalo",
    marca: "Volvo",
    modelo: "FH 540",
    ano: 2022,
    codigoFipe: "509035-0",
    valorFipeCentavos: 78_500_000,
    gestorId: "gestor-1",
    operacaoId: "op-1",
    crId: "cr-1001",
    situacaoInicial: "PÁT",
    ...parcial,
  });
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};

describe("cadastrar", () => {
  it("grava a placa normalizada com versão 1, situação inicial, gestor, operação e CR", () => {
    const a = novo();
    const r = a.cadastrar(entradaDeCadastro(), CHAVE_A, AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linha).toMatchObject({
      placa: "ZZZ9Z99",
      tipo: "cavalo",
      sigla: "PÁT",
      desde: AGORA,
      versao: 1,
      gestorId: "gestor-1",
      gestor: "Gestor Exemplo 1",
      operacaoId: "op-1",
      operacao: "Operação Exemplo 1",
      crId: "cr-1001",
    });
    expect(a.obterPlaca("ZZZ9Z99")).toEqual(r.linha);
  });

  it("a placa nova ganha um evento com hora (a sigla inicial)", () => {
    const a = novo();
    a.cadastrar(entradaDeCadastro(), CHAVE_A, AGORA);
    expect(a.eventosDaPlaca("ZZZ9Z99")).toEqual([{ sigla: "PÁT", em: AGORA }]);
  });

  it("a mesma chave de envio grava uma vez só e devolve a mesma linha (clique duplo, nova tentativa)", () => {
    const a = novo();
    const primeira = a.cadastrar(entradaDeCadastro(), CHAVE_A, AGORA);
    const segunda = a.cadastrar(entradaDeCadastro({ modelo: "Outro" }), CHAVE_A, DEPOIS);
    expect(segunda).toEqual(primeira);
    expect(a.placasCadastradas()).toHaveLength(1);
    expect(a.eventosDaPlaca("ZZZ9Z99")).toHaveLength(1);
  });

  it("placa que já existe, em qualquer formato, devolve placa_ja_existe com a placa que está lá", () => {
    const a = novo();
    const jaExiste = base[0]!.placa;
    const r = a.cadastrar(entradaDeCadastro({ placa: jaExiste.toLowerCase() }), CHAVE_A, AGORA);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.codigo).toBe("placa_ja_existe");
    expect((r.erro.atual as { placa: string }).placa).toBe(jaExiste);
    expect(a.placasCadastradas()).toHaveLength(0);
  });

  it("cadastrar a mesma placa de novo, com outra chave, é placa_ja_existe (regra 1: uma placa só)", () => {
    const a = novo();
    a.cadastrar(entradaDeCadastro(), CHAVE_A, AGORA);
    const r = a.cadastrar(entradaDeCadastro({ placa: "ZZZ-9Z99" }), CHAVE_B, DEPOIS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("placa_ja_existe");
    expect(a.placasCadastradas()).toHaveLength(1);
  });

  it("falha não gasta a chave: corrigir e mandar de novo com a mesma chave grava", () => {
    const a = novo();
    const jaExiste = base[0]!.placa;
    expect(a.cadastrar(entradaDeCadastro({ placa: jaExiste }), CHAVE_A, AGORA).ok).toBe(false);
    expect(a.cadastrar(entradaDeCadastro(), CHAVE_A, DEPOIS).ok).toBe(true);
  });

  it("gestor, operação, CR ou filial que não existem no catálogo viram erro de campo", () => {
    const a = novo();
    const r = a.cadastrar(entradaDeCadastro({ gestorId: "gestor-99" }), CHAVE_A, AGORA);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.codigo).toBe("entrada_invalida");
    expect(Object.keys(r.erro.campos ?? {})).toContain("gestorId");
    const r2 = a.cadastrar(entradaDeCadastro({ operacaoId: "op-9", crId: "cr-9" }), CHAVE_B, AGORA);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(Object.keys(r2.erro.campos ?? {})).toContain("operacaoId");
  });

  it("o CR tem de ser o da operação escolhida", () => {
    const a = novo();
    const r = a.cadastrar(
      entradaDeCadastro({ operacaoId: "op-1", crId: "cr-1002" }),
      CHAVE_A,
      AGORA,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erro.campos ?? {})).toContain("crId");
  });
});

const entradaDeDisponibilizar = (
  parcial: Partial<EntradaDisponibilizacao> = {},
): EntradaDisponibilizacao => ({
  placa: noPatio.placa,
  filialId: "filial-b",
  versaoDaPlaca: 1,
  ...parcial,
});

describe("disponibilizar ao Operacional", () => {
  it("leva a placa para DOp com a filial escolhida, sobe a versão e registra o evento com hora", () => {
    const a = novo();
    const r = a.disponibilizar(entradaDeDisponibilizar(), CHAVE_A, AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linha).toMatchObject({
      sigla: "DOp",
      filial: "Filial Exemplo B",
      versao: 2,
      desde: AGORA,
    });
    expect(a.obterPlaca(noPatio.placa)?.sigla).toBe("DOp");
    expect(a.eventosDaPlaca(noPatio.placa).at(-1)).toEqual({ sigla: "DOp", em: AGORA });
  });

  it("a mesma chave: sobe a versão uma vez só", () => {
    const a = novo();
    const primeira = a.disponibilizar(entradaDeDisponibilizar(), CHAVE_A, AGORA);
    const segunda = a.disponibilizar(entradaDeDisponibilizar(), CHAVE_A, DEPOIS);
    expect(segunda).toEqual(primeira);
    expect(a.obterPlaca(noPatio.placa)?.versao).toBe(2);
  });

  it("versão velha (outra pessoa mudou antes) devolve conflito com a linha atual, sem gravar", () => {
    const a = novo();
    a.disponibilizar(entradaDeDisponibilizar(), CHAVE_A, AGORA);
    const r = a.disponibilizar(entradaDeDisponibilizar({ filialId: "filial-c" }), CHAVE_B, DEPOIS);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.codigo).toBe("conflito");
    expect((r.erro.atual as { versao: number; filial: string }).versao).toBe(2);
    expect((r.erro.atual as { filial: string }).filial).toBe("Filial Exemplo B");
  });

  it("só de PÁT, VAz ou ETv: outra situação é recusada com o motivo no campo", () => {
    const a = novo();
    const r = a.disponibilizar(
      entradaDeDisponibilizar({ placa: foraDoPatio.placa }),
      CHAVE_A,
      AGORA,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro.codigo).toBe("entrada_invalida");
      expect(Object.keys(r.erro.campos ?? {})).toContain("placa");
    }
  });

  it("placa que não existe é nao_encontrado; filial que não existe é erro de campo", () => {
    const a = novo();
    const r = a.disponibilizar(entradaDeDisponibilizar({ placa: "QQQ0Q00" }), CHAVE_A, AGORA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("nao_encontrado");
    const r2 = a.disponibilizar(entradaDeDisponibilizar({ filialId: "filial-z" }), CHAVE_B, AGORA);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(Object.keys(r2.erro.campos ?? {})).toContain("filialId");
  });
});

const entradaDeRecebimento = (parcial: Partial<EntradaRecebimento> = {}): EntradaRecebimento => ({
  placa: foraDoPatio.placa,
  pedidoId: "ped-1",
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

describe("receber placa (transferência entre gestores)", () => {
  it("conclui o pedido, troca o gestor para o destino com vigência [início, fim) e muda situação, operação e CR", () => {
    const a = novo();
    const r = a.receber(entradaDeRecebimento(), CHAVE_A, AGORA, "gestor-2");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linha).toMatchObject({
      gestorId: "gestor-2",
      gestor: "Gestor Exemplo 2",
      sigla: "MAN",
      operacaoId: "op-2",
      crId: "cr-1002",
      versao: 2,
    });
    const vigencias = r.linha.gestores;
    expect(vigencias.at(-2)).toMatchObject({ fim: AGORA });
    expect(vigencias.at(-1)).toMatchObject({ gestorId: "gestor-2", inicio: AGORA, fim: null });
    expect(a.pedidoPendenteDa(foraDoPatio.placa)).toBeNull();
    expect(a.eventosDaPlaca(foraDoPatio.placa).at(-1)).toEqual({ sigla: "MAN", em: AGORA });
  });

  it("a mesma chave: conclui uma vez só", () => {
    const a = novo();
    const primeira = a.receber(entradaDeRecebimento(), CHAVE_A, AGORA, "gestor-2");
    const segunda = a.receber(entradaDeRecebimento(), CHAVE_A, DEPOIS, "gestor-2");
    expect(segunda).toEqual(primeira);
    expect(a.obterPlaca(foraDoPatio.placa)?.versao).toBe(2);
  });

  it("pedido já concluído por outra pessoa devolve conflito com o pedido como está agora", () => {
    const a = novo();
    a.receber(entradaDeRecebimento(), CHAVE_A, AGORA, "gestor-2");
    const r = a.receber(entradaDeRecebimento(), CHAVE_B, DEPOIS, "gestor-2");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.codigo).toBe("conflito");
    expect((r.erro.atual as { situacao: string }).situacao).toBe("concluido");
  });

  it("versão do pedido velha devolve conflito", () => {
    const a = novo();
    const r = a.receber(entradaDeRecebimento({ versaoDoPedido: 7 }), CHAVE_A, AGORA, "gestor-2");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("conflito");
  });

  it("versão da placa velha (a placa mudou depois de o pedido sair) devolve conflito com a placa atual", () => {
    const a = criarArmazem({
      placasBase: base,
      pedidosBase: [{ ...pedidoBase(noPatio.placa), id: "ped-2" }],
    });
    a.disponibilizar(entradaDeDisponibilizar(), CHAVE_A, AGORA); // a placa vai a versão 2
    const r = a.receber(
      entradaDeRecebimento({ placa: noPatio.placa, pedidoId: "ped-2", versaoDaPlaca: 1 }),
      CHAVE_B,
      DEPOIS,
      "gestor-2",
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.codigo).toBe("conflito");
    expect((r.erro.atual as { placa: string; versao: number }).placa).toBe(noPatio.placa);
    expect((r.erro.atual as { versao: number }).versao).toBe(2);
    expect(a.pedidoPendenteDa(noPatio.placa)).not.toBeNull(); // nada foi gravado
  });

  it("com as duas versões certas, recebe", () => {
    const a = criarArmazem({
      placasBase: base,
      pedidosBase: [{ ...pedidoBase(noPatio.placa), id: "ped-2" }],
    });
    a.disponibilizar(entradaDeDisponibilizar(), CHAVE_A, AGORA);
    const r = a.receber(
      entradaDeRecebimento({ placa: noPatio.placa, pedidoId: "ped-2", versaoDaPlaca: 2 }),
      CHAVE_B,
      DEPOIS,
      "gestor-2",
    );
    expect(r.ok).toBe(true);
  });

  it("a meta do conjunto é gravada no cavalo e recusada em qualquer outro tipo", () => {
    const cavalo = base.find((p) => p.tipo === "cavalo" && p.sigla !== "VND" && p.sigla !== "SUC")!;
    const outro = base.find(
      (p) => p.tipo === "implemento" && p.sigla !== "VND" && p.sigla !== "SUC",
    )!;
    const a = criarArmazem({
      placasBase: base,
      pedidosBase: [
        { ...pedidoBase(cavalo.placa), id: "ped-c" },
        { ...pedidoBase(outro.placa), id: "ped-i" },
      ],
    });
    const recusada = a.receber(
      entradaDeRecebimento({
        placa: outro.placa,
        pedidoId: "ped-i",
        metaDoConjuntoCentavos: 1_500_000,
      }),
      CHAVE_A,
      AGORA,
      "gestor-2",
    );
    expect(recusada.ok).toBe(false);
    if (!recusada.ok) {
      expect(recusada.erro.codigo).toBe("entrada_invalida");
      expect(Object.keys(recusada.erro.campos ?? {})).toContain("metaDoConjuntoCentavos");
    }
    const aceita = a.receber(
      entradaDeRecebimento({
        placa: cavalo.placa,
        pedidoId: "ped-c",
        metaDoConjuntoCentavos: 1_500_000,
      }),
      CHAVE_B,
      AGORA,
      "gestor-2",
    );
    expect(aceita.ok).toBe(true);
    if (aceita.ok) expect(aceita.linha.metaDoConjuntoCentavos).toBe(1_500_000);
  });

  it("quem não é o destinatário não recebe (sem_permissao) e nada muda", () => {
    const a = novo();
    const r = a.receber(entradaDeRecebimento(), CHAVE_A, AGORA, "gestor-3");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("sem_permissao");
    expect(a.pedidoPendenteDa(foraDoPatio.placa)).not.toBeNull();
    expect(a.obterPlaca(foraDoPatio.placa)?.versao).toBe(1);
  });

  it("pedido que não existe, ou de outra placa, não recebe", () => {
    const a = novo();
    const r = a.receber(entradaDeRecebimento({ pedidoId: "ped-9" }), CHAVE_A, AGORA, "gestor-2");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("nao_encontrado");
    const r2 = a.receber(
      entradaDeRecebimento({ placa: noPatio.placa }),
      CHAVE_B,
      AGORA,
      "gestor-2",
    );
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(Object.keys(r2.erro.campos ?? {})).toContain("placa");
  });

  it("o pedido pendente da placa aparece até ser recebido (é o que mostra a ação Receber placa)", () => {
    const a = novo();
    expect(a.pedidoPendenteDa(foraDoPatio.placa)?.id).toBe("ped-1");
    expect(a.pedidoPendenteDa(noPatio.placa)).toBeNull();
  });
});

describe("isolamento", () => {
  it("dois armazéns não compartilham estado", () => {
    const a = novo();
    const b = novo();
    a.cadastrar(entradaDeCadastro(), CHAVE_A, AGORA);
    expect(b.placasCadastradas()).toHaveLength(0);
  });
  it("o armazém do processo é um só (sobrevive ao recarregar de módulo em desenvolvimento)", () => {
    expect(armazemDoProcesso(HOJE)).toBe(armazemDoProcesso(HOJE));
  });
  it("uma chave de envio de uma ação não vale para outra", () => {
    const a = novo();
    a.cadastrar(entradaDeCadastro(), CHAVE_C, AGORA);
    const r = a.disponibilizar(entradaDeDisponibilizar(), CHAVE_C, AGORA);
    expect(r.ok).toBe(true);
    expect(a.obterPlaca(noPatio.placa)?.sigla).toBe("DOp");
  });
});
