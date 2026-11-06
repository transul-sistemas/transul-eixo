import { describe, expect, it } from "vitest";
import {
  MENSAGEM_DE_TIPO_QUE_NAO_ENTREGA,
  podeEntregar,
  SIGLAS_QUE_PODEM_ENTREGAR,
  type PedidoDeTransferencia,
} from "@/lib/dominio/custodia";
import {
  esquemaCadastrarPlaca,
  type EntradaCadastrarPlaca,
  type EntradaConcluirRecebimento,
  type EntradaDisponibilizarPlaca,
  type EntradaEntregaAoOperacional,
  type EntradaReceberPlaca,
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
const emOrigem = (sigla: string) =>
  (SIGLAS_QUE_PODEM_ENTREGAR as readonly string[]).includes(sigla);
const noPatio = base.find((p) => podeEntregar(p.sigla, p.tipo))!;
const carretaNoPatio = base.find((p) => p.tipo === "implemento" && emOrigem(p.sigla))!;
const foraDoPatio = base.find((p) => !emOrigem(p.sigla) && p.sigla !== "VND" && p.sigla !== "SUC")!;
const baixada = base.find((p) => p.sigla === "VND" || p.sigla === "SUC");

const pedidoBase = (placa: string): PedidoDeTransferencia => ({
  id: "ped-1",
  placa,
  deGestorId: "gestor-1",
  deGestor: "Gestor Exemplo 1",
  paraGestorId: "gestor-2",
  paraGestor: "Gestor Exemplo 2",
  motivo: "Troca de carteira",
  pendenciasConhecidas: [
    { id: "p1", texto: "CRLV vencendo" },
    { id: "p2", texto: "Revisão em aberto" },
  ],
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
    situacaoInicial: "PÁT",
    ...parcial,
  });
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};
const entradaDeEntrega = (
  parcial: Partial<EntradaEntregaAoOperacional> = {},
): EntradaEntregaAoOperacional => ({
  placa: noPatio.placa,
  filialId: "filial-b",
  versaoDaPlaca: 1,
  ...parcial,
});
const entradaDeEnvio = (
  parcial: Partial<EntradaDisponibilizarPlaca> = {},
): EntradaDisponibilizarPlaca => ({
  placa: noPatio.placa,
  paraGestorId: "gestor-6",
  motivo: "Troca de carteira",
  pendenciasConhecidas: ["CRLV vencendo"],
  versaoDaPlaca: 1,
  ...parcial,
});
const entradaDeRecebimento = (parcial: Partial<EntradaReceberPlaca> = {}): EntradaReceberPlaca => ({
  placa: foraDoPatio.placa,
  pedidoId: "ped-1",
  versaoDoPedido: 1,
  conferido: true,
  ...parcial,
});
const entradaDeConclusao = (
  parcial: Partial<EntradaConcluirRecebimento> = {},
): EntradaConcluirRecebimento => ({
  placa: foraDoPatio.placa,
  pedidoId: "ped-1",
  versaoDoPedido: 2,
  pendencias: [
    { id: "p1", resolvida: true, nota: null },
    { id: "p2", resolvida: false, nota: "Marcada para dezembro" },
  ],
  ...parcial,
});

describe("cadastrar", () => {
  it("grava a placa normalizada com versão 1, situação inicial, gestor, operação e CR", () => {
    const a = novo();
    const r = a.cadastrar(entradaDeCadastro(), CHAVE_A, AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linha).toMatchObject({
      placa: "ZZZ9Z99",
      versao: 1,
      sigla: "PÁT",
      gestorId: "gestor-1",
      operacaoId: "op-1",
      crId: "cr-1001",
    });
    expect(a.eventosDaPlaca("ZZZ9Z99")).toEqual([{ sigla: "PÁT", em: AGORA }]);
  });
  it("a mesma chave grava uma vez só e devolve a mesma linha", () => {
    const a = novo();
    const r1 = a.cadastrar(entradaDeCadastro(), CHAVE_A, AGORA);
    const r2 = a.cadastrar(entradaDeCadastro(), CHAVE_A, DEPOIS);
    expect(r2).toEqual(r1);
    expect(a.placasCadastradas()).toHaveLength(1);
  });
  it("placa que já existe, em qualquer formato, devolve placa_ja_existe com a placa que está lá", () => {
    const a = novo();
    const r = a.cadastrar(
      entradaDeCadastro({ placa: base[0]!.placa.toLowerCase() }),
      CHAVE_A,
      AGORA,
    );
    expect(!r.ok && r.erro.codigo).toBe("placa_ja_existe");
  });
  it("gestor, operação, CR, marca, modelo e carroceria que não existem viram erro de campo", () => {
    const a = novo();
    const r = a.cadastrar(
      entradaDeCadastro({ gestorId: "x", operacaoId: "x", crId: "x", marcaId: "x", modeloId: "x" }),
      CHAVE_A,
      AGORA,
    );
    expect(!r.ok && Object.keys(r.erro.campos ?? {}).sort()).toEqual(
      ["crId", "gestorId", "marcaId", "modeloId", "operacaoId"].sort(),
    );
    const implemento = a.cadastrar(
      entradaDeCadastro({
        tipo: "implemento",
        marcaId: "marca-randon",
        modeloId: "modelo-sider",
        funcao: "semirreboque",
        carroceriaId: "carroceria-inexistente",
        eixos: 3,
        valorManualCentavos: 100,
        fonteDoValor: "Nota",
        dataDoValor: "2026-09-10",
      }),
      CHAVE_B,
      AGORA,
    );
    expect(!implemento.ok && implemento.erro.campos?.carroceriaId).toBeTruthy();
  });
  it("o modelo tem de ser da marca; o CR, da operação escolhida (ou sem operação)", () => {
    const a = novo();
    const r = a.cadastrar(
      entradaDeCadastro({ modeloId: "modelo-r-450", crId: "cr-1002" }),
      CHAVE_A,
      AGORA,
    );
    expect(!r.ok && Object.keys(r.erro.campos ?? {}).sort()).toEqual(["crId", "modeloId"]);
  });
});

describe("entregar ao Operacional", () => {
  it("leva a placa para DOp com a filial, sobe a versão e registra o evento com hora", () => {
    const a = novo();
    const r = a.entregar(entradaDeEntrega(), CHAVE_A, AGORA);
    expect(r.ok && r.linha).toMatchObject({ sigla: "DOp", filialId: "filial-b", versao: 2 });
    expect(a.eventosDaPlaca(noPatio.placa).at(-1)).toEqual({ sigla: "DOp", em: AGORA });
  });
  it("a mesma chave: sobe a versão uma vez só", () => {
    const a = novo();
    a.entregar(entradaDeEntrega(), CHAVE_A, AGORA);
    a.entregar(entradaDeEntrega(), CHAVE_A, AGORA);
    expect(a.obterPlaca(noPatio.placa)?.versao).toBe(2);
  });
  it("versão velha devolve conflito com a linha atual, sem gravar", () => {
    const a = novo();
    a.entregar(entradaDeEntrega(), CHAVE_A, AGORA);
    const r = a.entregar(entradaDeEntrega(), CHAVE_B, DEPOIS);
    expect(!r.ok && r.erro.codigo).toBe("conflito");
    expect(a.obterPlaca(noPatio.placa)?.versao).toBe(2);
  });
  it("carreta é recusada com a mensagem do tipo; fora de PÁT e ETv também", () => {
    const a = novo();
    const r = a.entregar(entradaDeEntrega({ placa: carretaNoPatio.placa }), CHAVE_A, AGORA);
    expect(!r.ok && r.erro.campos?.placa?.[0]).toBe(MENSAGEM_DE_TIPO_QUE_NAO_ENTREGA);
  });
});

describe("disponibilizar placa (enviar a outro gestor)", () => {
  it("abre o pedido pendente com as pendências, sem mudar o gestor da placa", () => {
    const a = novo();
    const r = a.disponibilizar(entradaDeEnvio(), CHAVE_A, AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linha).toMatchObject({ situacao: "pendente", paraGestorId: "gestor-6", versao: 1 });
    expect(r.linha.pendenciasConhecidas).toHaveLength(1);
    expect(a.obterPlaca(noPatio.placa)?.gestor).toBe(noPatio.gestor);
    expect(a.pedidoAbertoDa(noPatio.placa)?.id).toBe(r.linha.id);
  });
  it("a mesma chave abre um pedido só; outra chave com pedido aberto é recusada", () => {
    const a = novo();
    const r1 = a.disponibilizar(entradaDeEnvio(), CHAVE_A, AGORA);
    expect(a.disponibilizar(entradaDeEnvio(), CHAVE_A, AGORA)).toEqual(r1);
    const r2 = a.disponibilizar(entradaDeEnvio(), CHAVE_B, AGORA);
    expect(!r2.ok && r2.erro.codigo).toBe("entrada_invalida");
  });
  it("versão velha é conflito; para o próprio gestor é erro de campo", () => {
    const a = novo();
    const velha = a.disponibilizar(entradaDeEnvio({ versaoDaPlaca: 9 }), CHAVE_A, AGORA);
    expect(!velha.ok && velha.erro.codigo).toBe("conflito");
    const dono = a.obterPlaca(noPatio.placa)!.gestorId!;
    const proprio = a.disponibilizar(entradaDeEnvio({ paraGestorId: dono }), CHAVE_B, AGORA);
    expect(!proprio.ok && proprio.erro.campos?.paraGestorId).toBeTruthy();
  });
  it("placa baixada não se disponibiliza", () => {
    if (!baixada) return;
    const a = novo();
    const r = a.disponibilizar(entradaDeEnvio({ placa: baixada.placa }), CHAVE_A, AGORA);
    expect(r.ok).toBe(false);
  });
});

describe("receber placa e concluir recebimento (as duas etapas)", () => {
  it("receber registra a chegada: em conferência, versão sobe, o gestor não muda", () => {
    const a = novo();
    const r = a.receber(entradaDeRecebimento(), CHAVE_A, AGORA, "gestor-2");
    expect(r.ok && r.linha).toMatchObject({ situacao: "em_conferencia", versao: 2 });
    expect(a.obterPlaca(foraDoPatio.placa)?.gestor).toBe(foraDoPatio.gestor);
    expect(a.pedidosParaReceber("gestor-2").map((p) => p.situacao)).toEqual(["em_conferencia"]);
  });
  it("a mesma chave recebe uma vez só; outra chave com a versão velha é conflito", () => {
    const a = novo();
    const r1 = a.receber(entradaDeRecebimento(), CHAVE_A, AGORA, "gestor-2");
    expect(a.receber(entradaDeRecebimento(), CHAVE_A, AGORA, "gestor-2")).toEqual(r1);
    const r2 = a.receber(entradaDeRecebimento(), CHAVE_B, AGORA, "gestor-2");
    expect(!r2.ok && r2.erro.codigo).toBe("conflito");
  });
  it("quem não é o destinatário não recebe (sem_permissao) e nada muda", () => {
    const a = novo();
    const r = a.receber(entradaDeRecebimento(), CHAVE_A, AGORA, "gestor-3");
    expect(!r.ok && r.erro.codigo).toBe("sem_permissao");
    expect(a.pedidoAbertoDa(foraDoPatio.placa)?.situacao).toBe("pendente");
  });
  it("concluir antes de receber é recusado", () => {
    const a = novo();
    const r = a.concluir(entradaDeConclusao({ versaoDoPedido: 1 }), CHAVE_A, AGORA, "gestor-2");
    expect(!r.ok && r.erro.mensagem).toMatch(/Receba a placa antes/);
  });
  it("concluir troca o gestor com vigência [início, fim), fecha o pedido e tira de Para receber", () => {
    const a = novo();
    a.receber(entradaDeRecebimento(), CHAVE_A, AGORA, "gestor-2");
    const r = a.concluir(entradaDeConclusao(), CHAVE_B, DEPOIS, "gestor-2");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linha.gestorId).toBe("gestor-2");
    expect(r.linha.gestores.at(-2)?.fim).toBe(DEPOIS);
    expect(r.linha.gestores.at(-1)).toMatchObject({
      gestorId: "gestor-2",
      inicio: DEPOIS,
      fim: null,
    });
    expect(a.pedidoAbertoDa(foraDoPatio.placa)).toBeNull();
    expect(a.pedidosParaReceber("gestor-2")).toEqual([]);
  });
  it("concluir sem responder cada pendência, uma vez, é recusado", () => {
    const a = novo();
    a.receber(entradaDeRecebimento(), CHAVE_A, AGORA, "gestor-2");
    const r = a.concluir(
      entradaDeConclusao({ pendencias: [{ id: "p1", resolvida: true, nota: null }] }),
      CHAVE_B,
      DEPOIS,
      "gestor-2",
    );
    expect(!r.ok && r.erro.mensagem).toMatch(/cada pendência/);
  });
  it("quem não é o destinatário não conclui", () => {
    const a = novo();
    a.receber(entradaDeRecebimento(), CHAVE_A, AGORA, "gestor-2");
    const r = a.concluir(entradaDeConclusao(), CHAVE_B, DEPOIS, "gestor-3");
    expect(!r.ok && r.erro.codigo).toBe("sem_permissao");
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
  it("cada sessão (cookie) tem o seu armazém, isolado dos outros e do padrão", () => {
    const padrao = armazemDoProcesso(HOJE);
    const a = armazemDoProcesso(HOJE, "sessao-de-teste-a");
    const b = armazemDoProcesso(HOJE, "sessao-de-teste-b");
    expect(a).not.toBe(padrao);
    expect(a).not.toBe(b);
    expect(armazemDoProcesso(HOJE, "sessao-de-teste-a")).toBe(a);
  });
  it("sessão com formato estranho cai no armazém padrão", () => {
    const padrao = armazemDoProcesso(HOJE);
    for (const lixo of ["", "a", "ab cd", "../x", "x".repeat(80), "ÀÁ-sessão", undefined]) {
      expect(armazemDoProcesso(HOJE, lixo), String(lixo)).toBe(padrao);
    }
  });
  it("o armazém de exemplo nasce com um pedido pendente para o gestor do exemplo", () => {
    const a = armazemDoProcesso(HOJE, "sessao-com-pedido");
    expect(a.pedidosParaReceber("gestor-2")).toHaveLength(1);
  });
  it("uma chave de envio de uma ação não vale para outra", () => {
    const a = novo();
    a.cadastrar(entradaDeCadastro(), CHAVE_C, AGORA);
    expect(a.entregar(entradaDeEntrega(), CHAVE_C, AGORA).ok).toBe(true);
  });
});

describe("itens de catálogo (o que o + cria)", () => {
  it("cria marca, gestor, operação, CR (com ou sem operação) e filial", () => {
    const a = novo();
    for (const entrada of [
      { tipo: "marca", nome: "DAF" },
      { tipo: "gestor", nome: "Gestor Novo" },
      { tipo: "operacao", nome: "Operação Nova" },
      { tipo: "cr", nome: "CR-2001", codcencus: 2001 },
      { tipo: "cr", nome: "CR-2002", codcencus: 2002, paiId: "op-1" },
      { tipo: "filial", nome: "Filial Nova" },
    ] as const) {
      expect(a.criarItemDeCatalogo(entrada, `${CHAVE_A}-${entrada.nome}`).ok, entrada.nome).toBe(
        true,
      );
    }
    const c = a.catalogos();
    expect(c.crs.find((x) => x.codigo === "CR-2001")?.operacaoId).toBeNull();
    expect(c.crs.find((x) => x.codigo === "CR-2002")?.operacaoId).toBe("op-1");
  });
  it("nome repetido é erro no campo nome", () => {
    const a = novo();
    const r = a.criarItemDeCatalogo({ tipo: "marca", nome: " volvo " }, CHAVE_A);
    expect(!r.ok && r.erro.campos?.nome).toBeTruthy();
  });
  it("modelo de marca que não existe é erro no campo paiId", () => {
    const a = novo();
    const r = a.criarItemDeCatalogo({ tipo: "modelo", nome: "XF", paiId: "marca-x" }, CHAVE_A);
    expect(!r.ok && r.erro.campos?.paiId).toBeTruthy();
  });
});

describe("a lista enxerga o que foi gravado", () => {
  it("a placa cadastrada aparece na lista, com tipo, modelo, gestor e a situação inicial", () => {
    const a = novo();
    a.cadastrar(entradaDeCadastro(), CHAVE_A, AGORA);
    const nova = a.placasParaLista().find((p) => p.placa === "ZZZ9Z99");
    expect(nova).toMatchObject({
      tipo: "cavalo",
      modelo: "FH 540",
      gestor: "Gestor Exemplo 1",
      sigla: "PÁT",
    });
  });
  it("uma placa da base entregue aparece mudada na lista, sem duplicar", () => {
    const a = novo();
    a.entregar(entradaDeEntrega(), CHAVE_A, AGORA);
    const todas = a.placasParaLista().filter((p) => p.placa === noPatio.placa);
    expect(todas).toHaveLength(1);
    expect(todas[0]?.sigla).toBe("DOp");
  });
});
