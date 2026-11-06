import { describe, expect, it } from "vitest";
import { SIGLAS, SIGLAS_DE_BAIXA } from "../status";
import {
  esquemaCadastrarPlaca,
  esquemaConcluirRecebimento,
  esquemaDisponibilizarPlaca,
  esquemaEntregaAoOperacional,
  esquemaEntregaAoOperacionalDe,
  esquemaItemDeCatalogo,
  esquemaReceberPlaca,
  problemasDoImplemento,
  siglasIniciaisDoTipo,
  validarRenavam,
} from "./placa";

const HOJE = "2026-10-31";
const ANO = 2026;

const base = {
  placa: "aaa-0a00",
  renavam: "00639884962",
  marcaId: "marca-volvo",
  modeloId: "modelo-fh-540",
  ano: 2022,
  gestorId: "gestor-1",
  operacaoId: "op-1",
  crId: "cr-1001",
  situacaoInicial: "PÁT",
};
const cavalo = {
  ...base,
  tipo: "cavalo",
  codigoFipe: "509035-0",
  valorFipeCentavos: 78_500_000,
};
const implemento = {
  ...base,
  tipo: "implemento",
  modeloId: "modelo-sider",
  funcao: "semirreboque",
  carroceriaId: "carroceria-sider",
  eixos: 3,
  valorManualCentavos: 25_000_000,
  fonteDoValor: "Nota fiscal de compra",
  dataDoValor: "2026-09-10",
};

const esquema = esquemaCadastrarPlaca({ anoAtual: ANO, hoje: HOJE });
const campos = (entrada: unknown) => {
  const r = esquema.safeParse(entrada);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("validarRenavam: 11 dígitos com dígito verificador", () => {
  it("aceita um RENAVAM válido, com ou sem pontuação", () => {
    expect(validarRenavam("00639884962")).toBe(true);
    expect(validarRenavam("0063988496-2")).toBe(true);
  });
  it("completa com zeros à esquerda o RENAVAM antigo de 9 e 10 dígitos", () => {
    expect(validarRenavam("639884962")).toBe(true);
    expect(validarRenavam("0639884962")).toBe(true);
  });
  it("recusa dígito verificador errado, tamanho errado e letras", () => {
    expect(validarRenavam("00639884963")).toBe(false);
    expect(validarRenavam("6398849")).toBe(false);
    expect(validarRenavam("006398849620")).toBe(false);
    expect(validarRenavam("0063988496A")).toBe(false);
    expect(validarRenavam("")).toBe(false);
  });
});

describe("esquemaCadastrarPlaca: identificação", () => {
  it("normaliza a placa (maiúscula, sem hífen) e aceita o cadastro de cavalo completo", () => {
    const r = esquema.safeParse(cavalo);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.placa).toBe("AAA0A00");
      expect(r.data.renavam).toBe("00639884962");
    }
  });
  it("aceita a placa antiga e a Mercosul", () => {
    expect(esquema.safeParse({ ...cavalo, placa: "ABC1234" }).success).toBe(true);
    expect(esquema.safeParse({ ...cavalo, placa: "abc1d23" }).success).toBe(true);
  });
  it("recusa placa mal formada", () => {
    for (const placa of ["", "AB1234", "ABCD123", "ABC12345", "123ABCD", "ÁBC1234"]) {
      expect(campos({ ...cavalo, placa }), placa).toContain("placa");
    }
  });
  it("recusa RENAVAM inválido", () => {
    expect(campos({ ...cavalo, renavam: "00639884963" })).toContain("renavam");
  });
  it("recusa tipo fora dos cinco (Veículo pequeno não existe mais)", () => {
    expect(esquema.safeParse({ ...cavalo, tipo: "veiculo_pequeno" }).success).toBe(false);
    expect(
      esquema.safeParse({ ...cavalo, tipo: "apoio", ...{ valorManualCentavos: 1 } }).success,
    ).toBe(
      false, // apoio sem fonte e data do valor
    );
  });
});

describe("esquemaCadastrarPlaca: veículo e ano", () => {
  it("marca e modelo são escolhas do cadastro (ids), obrigatórias", () => {
    expect(campos({ ...cavalo, marcaId: "" })).toContain("marcaId");
    expect(campos({ ...cavalo, modeloId: "" })).toContain("modeloId");
    expect(campos({ ...cavalo, marcaId: undefined })).toContain("marcaId");
    expect(campos({ ...cavalo, modeloId: undefined })).toContain("modeloId");
  });
  it("marca e modelo em texto livre não valem mais", () => {
    const r = esquema.safeParse({
      ...cavalo,
      marcaId: undefined,
      marca: "Volvo",
      modelo: "FH 540",
    });
    expect(r.success).toBe(false);
  });
  it("ano entre 1980 e o ano atual mais um", () => {
    expect(campos({ ...cavalo, ano: 1979 })).toContain("ano");
    expect(esquema.safeParse({ ...cavalo, ano: 1980 }).success).toBe(true);
    expect(esquema.safeParse({ ...cavalo, ano: ANO + 1 }).success).toBe(true);
    expect(campos({ ...cavalo, ano: ANO + 2 })).toContain("ano");
    expect(campos({ ...cavalo, ano: 2020.5 })).toContain("ano");
  });
});

describe("esquemaCadastrarPlaca: valor por tipo", () => {
  it("cavalo e caminhão: código FIPE e valor FIPE digitados", () => {
    for (const tipo of ["cavalo", "caminhao"]) {
      expect(esquema.safeParse({ ...cavalo, tipo }).success, tipo).toBe(true);
      expect(campos({ ...cavalo, tipo, codigoFipe: undefined }), tipo).toContain("codigoFipe");
      expect(campos({ ...cavalo, tipo, valorFipeCentavos: undefined }), tipo).toContain(
        "valorFipeCentavos",
      );
    }
  });
  it("o código FIPE tem o formato 000000-0", () => {
    for (const codigoFipe of ["5090350", "509035-", "ABC123-4", "509035-00"]) {
      expect(campos({ ...cavalo, codigoFipe }), codigoFipe).toContain("codigoFipe");
    }
  });
  it("implemento, equipamento e apoio: valor manual, fonte e data do valor", () => {
    for (const tipo of ["implemento", "equipamento", "apoio"]) {
      expect(esquema.safeParse({ ...implemento, tipo }).success, tipo).toBe(true);
      expect(campos({ ...implemento, tipo, fonteDoValor: "" }), tipo).toContain("fonteDoValor");
      expect(campos({ ...implemento, tipo, dataDoValor: undefined }), tipo).toContain(
        "dataDoValor",
      );
      expect(campos({ ...implemento, tipo, valorManualCentavos: undefined }), tipo).toContain(
        "valorManualCentavos",
      );
    }
  });
  it("a data do valor é uma data de verdade e não é futura", () => {
    expect(campos({ ...implemento, dataDoValor: "2026-11-01" })).toContain("dataDoValor");
    expect(campos({ ...implemento, dataDoValor: "2026-02-30" })).toContain("dataDoValor");
    expect(campos({ ...implemento, dataDoValor: "31/10/2026" })).toContain("dataDoValor");
    expect(esquema.safeParse({ ...implemento, dataDoValor: HOJE }).success).toBe(true);
  });
  it("dinheiro em centavos inteiros: positivo, sem fração e dentro do numeric(15,2)", () => {
    for (const valorFipeCentavos of [0, -1, 10.5, 1_000_000_000_000_000]) {
      expect(campos({ ...cavalo, valorFipeCentavos }), String(valorFipeCentavos)).toContain(
        "valorFipeCentavos",
      );
    }
    expect(esquema.safeParse({ ...cavalo, valorFipeCentavos: 999_999_999_999_999 }).success).toBe(
      true,
    );
  });
  it("campos do outro tipo de valor são ignorados, não vão adiante", () => {
    const r = esquema.safeParse({ ...cavalo, valorManualCentavos: 5, fonteDoValor: "x" });
    expect(r.success).toBe(true);
    if (r.success) expect("valorManualCentavos" in r.data).toBe(false);
  });
});

describe("esquemaCadastrarPlaca: posse e situação inicial", () => {
  it("o gestor é obrigatório", () => {
    expect(campos({ ...cavalo, gestorId: "" })).toContain("gestorId");
  });
  it("operação e CR são obrigatórios (toda placa tem operação e CR)", () => {
    expect(esquema.safeParse(cavalo).success).toBe(true);
    expect(campos({ ...cavalo, operacaoId: null })).toContain("operacaoId");
    expect(campos({ ...cavalo, operacaoId: "" })).toContain("operacaoId");
    expect(campos({ ...cavalo, crId: null })).toContain("crId");
  });
  it("o cadastro não pede mais filial nem garagem (a garagem vem do CR): os campos são ignorados", () => {
    const r = esquema.safeParse({ ...cavalo, filialId: "filial-a", garagemId: "garagem-a1" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect("filialId" in r.data).toBe(false);
      expect("garagemId" in r.data).toBe(false);
    }
  });
  it("a situação inicial padrão é PÁT", () => {
    const semSituacao: Partial<typeof cavalo> = { ...cavalo };
    delete semSituacao.situacaoInicial;
    const r = esquema.safeParse(semSituacao);
    expect(r.success && r.data.situacaoInicial).toBe("PÁT");
  });
  it("aceita as situações que se aplicam ao tipo (MAN, DOC, ALU, EMP, VEN...) e recusa as outras", () => {
    for (const situacaoInicial of ["MAN", "DOC", "ALU", "EMP", "VEN", "REF", "SIN", "SDo"]) {
      expect(esquema.safeParse({ ...cavalo, situacaoInicial }).success, situacaoInicial).toBe(true);
    }
    for (const situacaoInicial of ["DOp", "ETc", "FOg", "FEr", "ACe", "XXX"]) {
      expect(campos({ ...cavalo, situacaoInicial }), situacaoInicial).toContain("situacaoInicial");
    }
  });
  it("baixa (SUC e VND) nunca entra no cadastro", () => {
    for (const situacaoInicial of SIGLAS_DE_BAIXA) {
      expect(campos({ ...cavalo, situacaoInicial }), situacaoInicial).toContain("situacaoInicial");
    }
  });
  it("sem motorista (SMo) só para cavalo e caminhão; o apoio perde o SMo (efeito aceito em 01/11/2026)", () => {
    expect(esquema.safeParse({ ...cavalo, situacaoInicial: "SMo" }).success).toBe(true);
    expect(campos({ ...implemento, tipo: "apoio", situacaoInicial: "SMo" })).toContain(
      "situacaoInicial",
    );
    expect(campos({ ...implemento, situacaoInicial: "SMo" })).toContain("situacaoInicial");
  });
  it("não há conjunto no cadastro: o campo é ignorado", () => {
    const r = esquema.safeParse({ ...cavalo, conjunto: { implementoIds: ["x"] } });
    expect(r.success).toBe(true);
    if (r.success) expect("conjunto" in r.data).toBe(false);
  });
});

describe("esquemaCadastrarPlaca: função, carroceria e eixos do implemento", () => {
  it("semirreboque com carroceria e eixos de 1 a 6 passa", () => {
    for (const eixos of [1, 2, 3, 6]) {
      expect(esquema.safeParse({ ...implemento, eixos }).success, String(eixos)).toBe(true);
    }
  });
  it("implemento sem função não passa", () => {
    expect(campos({ ...implemento, funcao: undefined })).toContain("funcao");
    expect(campos({ ...implemento, funcao: "carreta" })).toContain("funcao");
  });
  it("semirreboque sem carroceria ou sem eixos fica recusado (nunca presumido)", () => {
    expect(campos({ ...implemento, carroceriaId: null })).toContain("carroceriaId");
    expect(campos({ ...implemento, eixos: null })).toContain("eixos");
    expect(campos({ ...implemento, eixos: 0 })).toContain("eixos");
    expect(campos({ ...implemento, eixos: 7 })).toContain("eixos");
    expect(campos({ ...implemento, eixos: 2.5 })).toContain("eixos");
  });
  it("dolly não tem carroceria e tem sempre 2 eixos", () => {
    const r = esquema.safeParse({
      ...implemento,
      funcao: "dolly",
      carroceriaId: null,
      eixos: null,
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.tipo === "implemento") {
      expect(r.data.eixos).toBe(2);
      expect(r.data.carroceriaId).toBeNull();
    }
    expect(campos({ ...implemento, funcao: "dolly" })).toContain("carroceriaId");
    expect(campos({ ...implemento, funcao: "dolly", carroceriaId: null, eixos: 3 })).toContain(
      "eixos",
    );
  });
  it("os outros tipos não têm função, carroceria nem eixos no cadastro (ignorados)", () => {
    const r = esquema.safeParse({ ...cavalo, funcao: "dolly", carroceriaId: "x", eixos: 3 });
    expect(r.success).toBe(true);
    if (r.success) expect("funcao" in r.data).toBe(false);
  });
});

describe("problemasDoImplemento: a regra da função, da carroceria e dos eixos, sozinha", () => {
  it("vale mesmo com o resto do formulário vazio (a tela confere no passo Veículo)", () => {
    expect(
      problemasDoImplemento({ funcao: "semirreboque", carroceriaId: "", eixos: null }),
    ).toEqual([
      {
        path: ["carroceriaId"],
        message: "O semirreboque precisa de carroceria. Escolha uma da lista.",
      },
      { path: ["eixos"], message: "Informe os eixos do semirreboque, de 1 a 6." },
    ]);
    expect(problemasDoImplemento({ funcao: "semirreboque", carroceriaId: "c", eixos: 3 })).toEqual(
      [],
    );
    expect(problemasDoImplemento({ funcao: "dolly", carroceriaId: null, eixos: null })).toEqual([]);
    expect(
      problemasDoImplemento({ funcao: "dolly", carroceriaId: "c", eixos: 3 }).map((p) => p.path[0]),
    ).toEqual(["carroceriaId", "eixos"]);
  });
});

describe("siglasIniciaisDoTipo", () => {
  it("PÁT vem primeiro (é o padrão) e nenhuma baixa aparece", () => {
    for (const tipo of ["cavalo", "implemento", "equipamento", "caminhao", "apoio"] as const) {
      const lista = siglasIniciaisDoTipo(tipo);
      expect(lista[0], tipo).toBe("PÁT");
      expect(
        lista.some((s) => SIGLAS_DE_BAIXA.includes(s)),
        tipo,
      ).toBe(false);
      expect(new Set(lista).size).toBe(lista.length);
      for (const s of lista) expect(SIGLAS, s).toContain(s);
    }
  });
  it("o apoio não tem SMo; cavalo e caminhão têm", () => {
    expect(siglasIniciaisDoTipo("apoio")).not.toContain("SMo");
    expect(siglasIniciaisDoTipo("cavalo")).toContain("SMo");
    expect(siglasIniciaisDoTipo("caminhao")).toContain("SMo");
  });
});

describe("esquemaEntregaAoOperacional: placa, filial e a versão que a pessoa viu", () => {
  const ok = { placa: "aaa-0a00", filialId: "filial-a", versaoDaPlaca: 3 };
  it("aceita e normaliza a placa", () => {
    const r = esquemaEntregaAoOperacional.safeParse(ok);
    expect(r.success && r.data.placa).toBe("AAA0A00");
  });
  it("a filial é obrigatória e a versão é um inteiro de 1 em diante", () => {
    expect(esquemaEntregaAoOperacional.safeParse({ ...ok, filialId: "" }).success).toBe(false);
    expect(esquemaEntregaAoOperacional.safeParse({ ...ok, versaoDaPlaca: 0 }).success).toBe(false);
    expect(esquemaEntregaAoOperacional.safeParse({ ...ok, versaoDaPlaca: 1.5 }).success).toBe(
      false,
    );
  });
  it("carreta é recusada com a mensagem do tipo; cavalo fora de PÁT e ETv também", () => {
    const carreta = esquemaEntregaAoOperacionalDe({ tipo: "implemento", sigla: "PÁT" }).safeParse(
      ok,
    );
    expect(carreta.success).toBe(false);
    if (!carreta.success) {
      expect(carreta.error.issues[0]?.message).toBe(
        "Só cavalo ou caminhão podem ser entregues ao Operacional.",
      );
    }
    expect(
      esquemaEntregaAoOperacionalDe({ tipo: "cavalo", sigla: "MAN" }).safeParse(ok).success,
    ).toBe(false);
    for (const tipo of ["cavalo", "caminhao"] as const) {
      for (const sigla of ["PÁT", "ETv"] as const) {
        expect(esquemaEntregaAoOperacionalDe({ tipo, sigla }).safeParse(ok).success).toBe(true);
      }
    }
  });
});

describe("esquemaDisponibilizarPlaca: quem envia deixa o destino, o motivo e as pendências", () => {
  const ok = {
    placa: "AAA0A00",
    paraGestorId: "gestor-2",
    motivo: "Troca de carteira",
    pendenciasConhecidas: ["CRLV vence em breve"],
    versaoDaPlaca: 2,
  };
  it("aceita, com ou sem pendências", () => {
    expect(esquemaDisponibilizarPlaca.safeParse(ok).success).toBe(true);
    expect(esquemaDisponibilizarPlaca.safeParse({ ...ok, pendenciasConhecidas: [] }).success).toBe(
      true,
    );
  });
  it("o motivo, o destino e a versão são obrigatórios", () => {
    expect(esquemaDisponibilizarPlaca.safeParse({ ...ok, motivo: " " }).success).toBe(false);
    expect(esquemaDisponibilizarPlaca.safeParse({ ...ok, paraGestorId: "" }).success).toBe(false);
    expect(esquemaDisponibilizarPlaca.safeParse({ ...ok, versaoDaPlaca: 0 }).success).toBe(false);
  });
  it("pendência vazia não vale; no máximo 20", () => {
    expect(
      esquemaDisponibilizarPlaca.safeParse({ ...ok, pendenciasConhecidas: [" "] }).success,
    ).toBe(false);
    expect(
      esquemaDisponibilizarPlaca.safeParse({
        ...ok,
        pendenciasConhecidas: Array.from({ length: 21 }, (_, i) => `P${i}`),
      }).success,
    ).toBe(false);
  });
});

describe("esquemaReceberPlaca: a primeira etapa registra a chegada", () => {
  const ok = { placa: "AAA0A00", pedidoId: "ped-1", versaoDoPedido: 1, conferido: true };
  it("aceita com a chegada conferida", () => {
    expect(esquemaReceberPlaca.safeParse(ok).success).toBe(true);
  });
  it("sem conferir o que chegou, ou sem a versão do pedido, não", () => {
    expect(esquemaReceberPlaca.safeParse({ ...ok, conferido: false }).success).toBe(false);
    expect(esquemaReceberPlaca.safeParse({ ...ok, versaoDoPedido: undefined }).success).toBe(false);
    expect(esquemaReceberPlaca.safeParse({ ...ok, pedidoId: "" }).success).toBe(false);
  });
});

describe("esquemaConcluirRecebimento: a segunda etapa responde cada pendência", () => {
  const ok = {
    placa: "AAA0A00",
    pedidoId: "ped-1",
    versaoDoPedido: 2,
    pendencias: [
      { id: "p1", resolvida: true, nota: "" },
      { id: "p2", resolvida: false, nota: "Revisão marcada para dezembro" },
    ],
  };
  it("aceita: resolvida sem nota, não resolvida com nota; a nota vazia vira nula", () => {
    const r = esquemaConcluirRecebimento.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.pendencias[0]?.nota).toBeNull();
  });
  it("não resolvida exige a nota, no campo da pendência", () => {
    const r = esquemaConcluirRecebimento.safeParse({
      ...ok,
      pendencias: [{ id: "p1", resolvida: false, nota: " " }],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path.join("."))).toContain("pendencias.0.nota");
    }
  });
  it("sem pendências também conclui; pendência repetida não", () => {
    expect(esquemaConcluirRecebimento.safeParse({ ...ok, pendencias: [] }).success).toBe(true);
    expect(
      esquemaConcluirRecebimento.safeParse({
        ...ok,
        pendencias: [
          { id: "p1", resolvida: true, nota: null },
          { id: "p1", resolvida: true, nota: null },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("esquemaItemDeCatalogo: o que o mini-wizard do + cria", () => {
  const ok = { tipo: "marca", nome: "Volvo" };
  it("aceita marca, gestor, operação e filial só com o nome", () => {
    for (const tipo of ["marca", "gestor", "operacao", "filial"]) {
      expect(esquemaItemDeCatalogo.safeParse({ tipo, nome: "Nome certo" }).success, tipo).toBe(
        true,
      );
    }
  });
  it("garagem não se cadastra mais pelo + (garagem é a filial, as 3)", () => {
    expect(
      esquemaItemDeCatalogo.safeParse({ tipo: "garagem", nome: "Garagem 3", paiId: "filial-a" })
        .success,
    ).toBe(false);
  });
  it("modelo precisa da marca", () => {
    expect(esquemaItemDeCatalogo.safeParse({ tipo: "modelo", nome: "FH 540" }).success).toBe(false);
    expect(
      esquemaItemDeCatalogo.safeParse({ tipo: "modelo", nome: "FH 540", paiId: "marca-volvo" })
        .success,
    ).toBe(true);
  });
  it("o CR pede o código do Sankhya (CODCENCUS, inteiro positivo); a operação é opcional", () => {
    const cr = (extra: object) =>
      esquemaItemDeCatalogo.safeParse({ tipo: "cr", nome: "CR-1006", ...extra });
    expect(cr({}).success).toBe(false);
    expect(cr({ codcencus: 0 }).success).toBe(false);
    expect(cr({ codcencus: 1.5 }).success).toBe(false);
    expect(cr({ codcencus: 2010101 }).success).toBe(true);
    expect(cr({ codcencus: 2010101, paiId: "op-1" }).success).toBe(true);
  });
  it("o código do CR é texto livre, de 2 a 60 caracteres, sem espaços sobrando", () => {
    for (const nome of ["1006", "CR1006", "cr-1006", "CC 300-A"]) {
      expect(
        esquemaItemDeCatalogo.safeParse({ tipo: "cr", nome, codcencus: 1 }).success,
        nome,
      ).toBe(true);
    }
    for (const nome of ["", " ", "A", "x".repeat(61)]) {
      expect(
        esquemaItemDeCatalogo.safeParse({ tipo: "cr", nome, codcencus: 1 }).success,
        JSON.stringify(nome),
      ).toBe(false);
    }
  });
  it("o nome é obrigatório, sem espaços sobrando, de 2 a 60 caracteres", () => {
    expect(esquemaItemDeCatalogo.safeParse({ ...ok, nome: " " }).success).toBe(false);
    expect(esquemaItemDeCatalogo.safeParse({ ...ok, nome: "A" }).success).toBe(false);
    const r = esquemaItemDeCatalogo.safeParse({ ...ok, nome: "  Scania  " });
    expect(r.success && r.data.nome).toBe("Scania");
  });
  it("tipo desconhecido não vale; o pai de quem não tem pai é ignorado", () => {
    expect(esquemaItemDeCatalogo.safeParse({ tipo: "cor", nome: "Azul" }).success).toBe(false);
    const r = esquemaItemDeCatalogo.safeParse({ ...ok, paiId: "qualquer" });
    expect(r.success).toBe(true);
    if (r.success) expect("paiId" in r.data).toBe(false);
  });
});
