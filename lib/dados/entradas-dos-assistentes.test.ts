import { describe, expect, it } from "vitest";
import { esquemaCadastrarPlaca, esquemaRecebimento } from "@/lib/dominio/esquemas/placa";
import { paraEntradaDoCadastro, paraEntradaDoRecebimento } from "./entradas-dos-assistentes";

const cadastroDaTela = {
  placa: "zzz-9z99",
  renavam: "00639884962",
  tipo: "cavalo",
  marcaId: "marca-volvo",
  modeloId: "modelo-fh-540",
  ano: 2022,
  codigoFipe: "509035-0",
  valorFipeCentavos: 78_500_000,
  valorManualCentavos: 0,
  fonteDoValor: "",
  dataDoValor: "",
  gestorId: "gestor-1",
  operacaoId: "",
  crId: "",
  filialId: "filial-a",
  garagemId: "garagem-a1",
  situacaoInicial: "PÁT",
};
const esquema = esquemaCadastrarPlaca({ anoAtual: 2026, hoje: "2026-10-31" });

describe("paraEntradaDoCadastro: o que a tela digita vira o que o esquema espera", () => {
  it("sem operação nem CR (campos vazios), vira nulo e o cadastro vale", () => {
    const entrada = paraEntradaDoCadastro(cadastroDaTela);
    expect(entrada.operacaoId).toBeNull();
    expect(entrada.crId).toBeNull();
    expect(esquema.safeParse(entrada).success).toBe(true);
  });

  it("com operação e CR escolhidos, mantém os ids", () => {
    const entrada = paraEntradaDoCadastro({
      ...cadastroDaTela,
      operacaoId: "op-1",
      crId: "cr-1001",
    });
    expect(entrada.operacaoId).toBe("op-1");
    expect(entrada.crId).toBe("cr-1001");
    expect(esquema.safeParse(entrada).success).toBe(true);
  });

  it("ano vazio (NaN ou ausente) não é um número: o esquema pede o ano", () => {
    for (const ano of [Number.NaN, undefined, null]) {
      const r = esquema.safeParse(paraEntradaDoCadastro({ ...cadastroDaTela, ano }));
      expect(r.success, String(ano)).toBe(false);
      if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toContain("ano");
    }
  });

  it("tipo ainda não escolhido (vazio) pede o tipo, em vez de quebrar", () => {
    const r = esquema.safeParse(paraEntradaDoCadastro({ ...cadastroDaTela, tipo: "" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toContain("tipo");
  });

  it("não muda o objeto de entrada", () => {
    const copia = structuredClone(cadastroDaTela);
    paraEntradaDoCadastro(cadastroDaTela);
    expect(cadastroDaTela).toEqual(copia);
  });
});

const recebimentoDaTela = {
  placa: "AAA0A00",
  pedidoId: "ped-1",
  versaoDoPedido: 1,
  versaoDaPlaca: 1,
  conferido: true,
  situacao: "MAN",
  operacaoId: "",
  crId: "",
  motoristaId: "",
  metaDoConjuntoCentavos: 0,
  conjunto: { cavaloId: "", implementoIds: [] as string[] },
  pendencias: [{ id: "p1", resolvida: true }],
};

describe("paraEntradaDoRecebimento", () => {
  it("campos vazios viram nulo e a meta zero vira vazia", () => {
    const entrada = paraEntradaDoRecebimento(recebimentoDaTela);
    expect(entrada).toMatchObject({
      operacaoId: null,
      crId: null,
      motoristaId: null,
      metaDoConjuntoCentavos: null,
      conjunto: { cavaloId: null, implementoIds: [] },
    });
    expect(esquemaRecebimento("cavalo").safeParse(entrada).success).toBe(true);
  });
  it("meta digitada fica; cavalo do implemento fica; motorista escolhido fica", () => {
    const entrada = paraEntradaDoRecebimento({
      ...recebimentoDaTela,
      metaDoConjuntoCentavos: 1_500_000,
      motoristaId: "motorista-1",
      conjunto: { cavaloId: "pl-001", implementoIds: [] },
    });
    expect(entrada.metaDoConjuntoCentavos).toBe(1_500_000);
    expect(entrada.motoristaId).toBe("motorista-1");
    expect(entrada.conjunto.cavaloId).toBe("pl-001");
  });
  it("a meta digitada em quem não é cavalo continua sendo recusada pelo esquema do tipo", () => {
    const entrada = paraEntradaDoRecebimento({ ...recebimentoDaTela, metaDoConjuntoCentavos: 100 });
    expect(esquemaRecebimento("implemento").safeParse(entrada).success).toBe(false);
  });
  it("não muda o objeto de entrada", () => {
    const copia = structuredClone(recebimentoDaTela);
    paraEntradaDoRecebimento(recebimentoDaTela);
    expect(recebimentoDaTela).toEqual(copia);
  });
});
