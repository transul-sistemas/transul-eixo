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
      marcaId: "marca-volvo",
      marca: "Volvo",
      modeloId: "modelo-fh-540",
      modelo: "FH 540",
      filialId: "filial-a",
      filial: "Filial Exemplo A",
      garagemId: "garagem-a1",
      garagem: "Garagem A1",
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
    const segunda = a.cadastrar(entradaDeCadastro({ modeloId: "modelo-r-450" }), CHAVE_A, DEPOIS);
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

  it("o modelo tem de ser da marca escolhida, e a garagem, da filial escolhida", () => {
    const a = novo();
    const r1 = a.cadastrar(entradaDeCadastro({ modeloId: "modelo-r-450" }), CHAVE_A, AGORA); // R 450 é da Scania
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(Object.keys(r1.erro.campos ?? {})).toContain("modeloId");
    const r2 = a.cadastrar(entradaDeCadastro({ garagemId: "garagem-b1" }), CHAVE_B, AGORA); // B1 é da filial B
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(Object.keys(r2.erro.campos ?? {})).toContain("garagemId");
  });

  it("marca, modelo, filial e garagem que não existem viram erro de campo", () => {
    const a = novo();
    const r = a.cadastrar(
      entradaDeCadastro({ marcaId: "m-9", modeloId: "mo-9", filialId: "f-9", garagemId: "g-9" }),
      CHAVE_A,
      AGORA,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const campos = Object.keys(r.erro.campos ?? {});
      for (const campo of ["marcaId", "modeloId", "filialId", "garagemId"]) {
        expect(campos).toContain(campo);
      }
    }
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

describe("itens de catálogo (o que o + cria)", () => {
  it("cria uma marca, que passa a existir no catálogo e a valer no cadastro", () => {
    const a = novo();
    const r = a.criarItemDeCatalogo({ tipo: "marca", nome: "DAF" }, CHAVE_A);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linha).toMatchObject({ tipo: "marca", nome: "DAF" });
    expect(a.catalogos().marcas.some((m) => m.id === r.linha.id)).toBe(true);
    const modelo = a.criarItemDeCatalogo(
      { tipo: "modelo", nome: "XF 530", paiId: r.linha.id },
      CHAVE_B,
    );
    expect(modelo.ok).toBe(true);
    if (!modelo.ok) return;
    const cadastro = a.cadastrar(
      entradaDeCadastro({ marcaId: r.linha.id, modeloId: modelo.linha.id }),
      CHAVE_C,
      AGORA,
    );
    expect(cadastro.ok).toBe(true);
    if (cadastro.ok) expect(cadastro.linha).toMatchObject({ marca: "DAF", modelo: "XF 530" });
  });

  it("cria gestor, operação, CR (de uma operação), filial e garagem (de uma filial)", () => {
    const a = novo();
    const operacao = a.criarItemDeCatalogo({ tipo: "operacao", nome: "Operação Nova" }, CHAVE_A);
    const filial = a.criarItemDeCatalogo({ tipo: "filial", nome: "Filial Nova" }, CHAVE_B);
    const gestor = a.criarItemDeCatalogo({ tipo: "gestor", nome: "Gestor Novo" }, CHAVE_C);
    expect([operacao.ok, filial.ok, gestor.ok]).toEqual([true, true, true]);
    if (!operacao.ok || !filial.ok) return;
    const cr = a.criarItemDeCatalogo(
      { tipo: "cr", nome: "CR-2001", paiId: operacao.linha.id },
      "44444444-4444-4444-8444-444444444444",
    );
    const garagem = a.criarItemDeCatalogo(
      { tipo: "garagem", nome: "Garagem Nova", paiId: filial.linha.id },
      "55555555-5555-4555-8555-555555555555",
    );
    expect([cr.ok, garagem.ok]).toEqual([true, true]);
    const c = a.catalogos();
    expect(c.gestores.some((g) => g.nome === "Gestor Novo")).toBe(true);
    expect(c.crs.some((x) => x.codigo === "CR-2001" && x.operacaoId === operacao.linha.id)).toBe(
      true,
    );
    expect(
      c.garagens.some((g) => g.nome === "Garagem Nova" && g.filialId === filial.linha.id),
    ).toBe(true);
  });

  it("a mesma chave cria uma vez só", () => {
    const a = novo();
    const primeira = a.criarItemDeCatalogo({ tipo: "marca", nome: "DAF" }, CHAVE_A);
    const segunda = a.criarItemDeCatalogo({ tipo: "marca", nome: "DAF" }, CHAVE_A);
    expect(segunda).toEqual(primeira);
    expect(a.catalogos().marcas.filter((m) => m.nome === "DAF")).toHaveLength(1);
  });

  it("nome repetido (sem olhar maiúscula nem espaço) é erro no campo nome, e o mesmo nome em outra marca vale", () => {
    const a = novo();
    const repetido = a.criarItemDeCatalogo({ tipo: "marca", nome: "  volvo " }, CHAVE_A);
    expect(repetido.ok).toBe(false);
    if (!repetido.ok) expect(Object.keys(repetido.erro.campos ?? {})).toContain("nome");
    const emOutraMarca = a.criarItemDeCatalogo(
      { tipo: "modelo", nome: "FH 540", paiId: "marca-scania" },
      CHAVE_B,
    );
    expect(emOutraMarca.ok).toBe(true);
    const mesmaMarca = a.criarItemDeCatalogo(
      { tipo: "modelo", nome: "fh 540", paiId: "marca-volvo" },
      CHAVE_C,
    );
    expect(mesmaMarca.ok).toBe(false);
  });

  it("pai que não existe é erro no campo paiId", () => {
    const a = novo();
    for (const [tipo, nome] of [
      ["modelo", "Modelo Novo"],
      ["garagem", "Garagem Nova"],
      ["cr", "CR-2002"],
    ] as const) {
      const r = a.criarItemDeCatalogo({ tipo, nome, paiId: "nao-existe" }, CHAVE_A);
      expect(r.ok, tipo).toBe(false);
      if (!r.ok) expect(Object.keys(r.erro.campos ?? {}), tipo).toContain("paiId");
    }
  });

  it("os catálogos de cada armazém são independentes", () => {
    const a = novo();
    const b = novo();
    a.criarItemDeCatalogo({ tipo: "marca", nome: "DAF" }, CHAVE_A);
    expect(b.catalogos().marcas.some((m) => m.nome === "DAF")).toBe(false);
  });
});

describe("a lista e a ficha enxergam o que foi gravado", () => {
  it("a placa cadastrada aparece na lista, com tipo, modelo, gestor, operação e a situação inicial", () => {
    const a = novo();
    const total = a.placasParaLista().length;
    a.cadastrar(entradaDeCadastro(), CHAVE_A, AGORA);
    const lista = a.placasParaLista();
    expect(lista).toHaveLength(total + 1);
    const nova = lista.find((p) => p.placa === "ZZZ9Z99");
    expect(nova).toMatchObject({
      tipo: "cavalo",
      modelo: "FH 540",
      sigla: "PÁT",
      desde: AGORA,
      gestor: "Gestor Exemplo 1",
      operacao: "Operação Exemplo 1",
      filial: "Filial Exemplo A",
      valorFipeCentavos: 78_500_000,
    });
    expect(nova?.crs).toEqual([
      { codigo: "CR-1001", nome: "Operação Exemplo 1", inicio: "2026-10-31", fim: null },
    ]);
  });

  it("uma placa da base mudada (disponibilizar) aparece mudada na lista, sem duplicar", () => {
    const a = novo();
    const total = a.placasParaLista().length;
    a.disponibilizar(entradaDeDisponibilizar(), CHAVE_A, AGORA);
    const lista = a.placasParaLista();
    expect(lista).toHaveLength(total);
    const mudada = lista.find((p) => p.placa === noPatio.placa);
    expect(mudada).toMatchObject({ sigla: "DOp", desde: AGORA, filial: "Filial Exemplo B" });
    expect(mudada?.km).toBe(noPatio.km); // o que o assistente não mexe segue como era
  });

  it("receber troca o gestor e fecha o CR antigo no dia, abrindo o novo", () => {
    const a = novo();
    a.receber(entradaDeRecebimento(), CHAVE_A, AGORA, "gestor-2");
    const mudada = a.placasParaLista().find((p) => p.placa === foraDoPatio.placa);
    expect(mudada).toMatchObject({
      gestor: "Gestor Exemplo 2",
      sigla: "MAN",
      operacao: "Operação Exemplo 2",
    });
    const crs = mudada?.crs ?? [];
    expect(crs.at(-1)).toEqual({
      codigo: "CR-1002",
      nome: "Operação Exemplo 2",
      inicio: "2026-10-31",
      fim: null,
    });
    for (const anterior of crs.slice(0, -1)) expect(anterior.fim).not.toBeNull();
  });

  it("os eventos da ficha trazem a situação nova com a hora", () => {
    const a = novo();
    a.cadastrar(entradaDeCadastro(), CHAVE_A, AGORA);
    expect(a.eventosDaPlaca("ZZZ9Z99").at(-1)).toEqual({ sigla: "PÁT", em: AGORA });
  });
});

describe("candidatos do conjunto (para o Receber placa)", () => {
  it("o cavalo escolhe entre implementos que não têm cavalo; o implemento, entre cavalos", () => {
    const a = novo();
    const cavalo = base.find((p) => p.tipo === "cavalo")!;
    const implemento = base.find((p) => p.tipo === "implemento")!;
    const paraCavalo = a.candidatosDoConjunto(cavalo.placa);
    expect(paraCavalo.length).toBeGreaterThan(0);
    for (const c of paraCavalo) {
      const p = base.find((x) => x.id === c.id)!;
      expect(p.tipo).toBe("implemento");
    }
    const paraImplemento = a.candidatosDoConjunto(implemento.placa);
    expect(paraImplemento.length).toBeGreaterThan(0);
    for (const c of paraImplemento) {
      expect(base.find((x) => x.id === c.id)!.tipo).toBe("cavalo");
    }
  });
  it("equipamento, caminhão e apoio não têm conjunto", () => {
    const a = novo();
    for (const tipo of ["equipamento", "caminhao", "apoio"] as const) {
      const p = base.find((x) => x.tipo === tipo)!;
      expect(a.candidatosDoConjunto(p.placa), tipo).toEqual([]);
    }
  });
});
