import { describe, expect, it } from "vitest";
import { SIGLAS, SIGLAS_DE_BAIXA } from "../status";
import {
  esquemaCadastrarPlaca,
  esquemaDisponibilizacao,
  esquemaDisponibilizacaoDe,
  esquemaEnvioDeTransferencia,
  esquemaItemDeCatalogo,
  esquemaRecebimento,
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
  operacaoId: null,
  crId: null,
  filialId: "filial-a",
  garagemId: "garagem-a1",
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
  it("filial e garagem são obrigatórias (escolhas do cadastro)", () => {
    expect(campos({ ...cavalo, filialId: "" })).toContain("filialId");
    expect(campos({ ...cavalo, garagemId: "" })).toContain("garagemId");
    expect(campos({ ...cavalo, filialId: undefined })).toContain("filialId");
    expect(campos({ ...cavalo, garagemId: undefined })).toContain("garagemId");
  });
  it("o gestor é obrigatório", () => {
    expect(campos({ ...cavalo, gestorId: "" })).toContain("gestorId");
  });
  it("operação exige CR, e CR sem operação não existe", () => {
    expect(esquema.safeParse({ ...cavalo, operacaoId: "op-1", crId: "cr-1" }).success).toBe(true);
    expect(campos({ ...cavalo, operacaoId: "op-1", crId: null })).toContain("crId");
    expect(campos({ ...cavalo, operacaoId: null, crId: "cr-1" })).toContain("operacaoId");
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
    expect(campos({ ...implemento, tipo: "equipamento", situacaoInicial: "SMo" })).toContain(
      "situacaoInicial",
    );
  });
  it("não há conjunto no cadastro: o campo é ignorado", () => {
    const r = esquema.safeParse({ ...cavalo, conjunto: { implementoIds: ["x"] } });
    expect(r.success).toBe(true);
    if (r.success) expect("conjunto" in r.data).toBe(false);
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
});

describe("esquemaDisponibilizacao: placa, filial e a versão que a pessoa viu", () => {
  const ok = { placa: "aaa-0a00", filialId: "filial-a", versaoDaPlaca: 3 };
  it("aceita e normaliza a placa", () => {
    const r = esquemaDisponibilizacao.safeParse(ok);
    expect(r.success && r.data.placa).toBe("AAA0A00");
  });
  it("a filial é obrigatória e a versão é um inteiro de 1 em diante", () => {
    expect(esquemaDisponibilizacao.safeParse({ ...ok, filialId: "" }).success).toBe(false);
    expect(esquemaDisponibilizacao.safeParse({ ...ok, versaoDaPlaca: 0 }).success).toBe(false);
    expect(esquemaDisponibilizacao.safeParse({ ...ok, versaoDaPlaca: 1.5 }).success).toBe(false);
    expect(esquemaDisponibilizacao.safeParse({ ...ok, versaoDaPlaca: undefined }).success).toBe(
      false,
    );
  });
});

describe("esquemaRecebimento: quem recebe confere e conclui", () => {
  const ok = {
    placa: "AAA0A00",
    pedidoId: "ped-1",
    versaoDoPedido: 2,
    versaoDaPlaca: 3,
    conferido: true,
    situacao: "PÁT",
    operacaoId: null,
    crId: null,
    motoristaId: null,
    metaDoConjuntoCentavos: null,
    conjunto: { cavaloId: null, implementoIds: [] },
    pendencias: [{ id: "p1", resolvida: true }],
  };
  const esquemaDoCavalo = esquemaRecebimento("cavalo");
  it("aceita o recebimento completo", () => {
    expect(esquemaDoCavalo.safeParse(ok).success).toBe(true);
  });
  it("só conclui depois de conferir o que chegou", () => {
    expect(esquemaDoCavalo.safeParse({ ...ok, conferido: false }).success).toBe(false);
  });
  it("não conclui com pendência aberta", () => {
    const r = esquemaDoCavalo.safeParse({
      ...ok,
      pendencias: [
        { id: "p1", resolvida: true },
        { id: "p2", resolvida: false },
      ],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toContain("pendencias");
  });
  it("a situação é a do tipo e nunca uma baixa", () => {
    expect(esquemaDoCavalo.safeParse({ ...ok, situacao: "DOC" }).success).toBe(true);
    expect(esquemaDoCavalo.safeParse({ ...ok, situacao: "VND" }).success).toBe(false);
    expect(esquemaRecebimento("implemento").safeParse({ ...ok, situacao: "SMo" }).success).toBe(
      false,
    );
  });
  it("operação exige CR", () => {
    expect(esquemaDoCavalo.safeParse({ ...ok, operacaoId: "op-1", crId: "cr-1" }).success).toBe(
      true,
    );
    expect(esquemaDoCavalo.safeParse({ ...ok, operacaoId: "op-1", crId: null }).success).toBe(
      false,
    );
  });
  it("a meta do conjunto é dinheiro em centavos, positiva, ou vazia", () => {
    expect(esquemaDoCavalo.safeParse({ ...ok, metaDoConjuntoCentavos: 1_500_000 }).success).toBe(
      true,
    );
    expect(esquemaDoCavalo.safeParse({ ...ok, metaDoConjuntoCentavos: -1 }).success).toBe(false);
    expect(esquemaDoCavalo.safeParse({ ...ok, metaDoConjuntoCentavos: 10.5 }).success).toBe(false);
  });
  it("confere a versão do pedido E a da placa: falta de qualquer uma recusa", () => {
    const semPedido: Partial<typeof ok> = { ...ok };
    delete semPedido.versaoDoPedido;
    const semPlaca: Partial<typeof ok> = { ...ok };
    delete semPlaca.versaoDaPlaca;
    const r1 = esquemaDoCavalo.safeParse(semPedido);
    const r2 = esquemaDoCavalo.safeParse(semPlaca);
    expect(r1.success).toBe(false);
    expect(r2.success).toBe(false);
    if (!r1.success)
      expect(r1.error.issues.map((i) => i.path.join("."))).toContain("versaoDoPedido");
    if (!r2.success)
      expect(r2.error.issues.map((i) => i.path.join("."))).toContain("versaoDaPlaca");
    expect(esquemaDoCavalo.safeParse({ ...ok, versaoDoPedido: 0 }).success).toBe(false);
    expect(esquemaDoCavalo.safeParse({ ...ok, versaoDaPlaca: 1.5 }).success).toBe(false);
  });
  it("a meta do conjunto é do cavalo, o mestre: só o cavalo a recebe", () => {
    expect(esquemaDoCavalo.safeParse({ ...ok, metaDoConjuntoCentavos: 1_500_000 }).success).toBe(
      true,
    );
    for (const tipo of ["implemento", "equipamento", "caminhao", "apoio"] as const) {
      const r = esquemaRecebimento(tipo).safeParse({ ...ok, metaDoConjuntoCentavos: 1_500_000 });
      expect(r.success, tipo).toBe(false);
      if (!r.success) {
        expect(
          r.error.issues.map((i) => i.path.join(".")),
          tipo,
        ).toContain("metaDoConjuntoCentavos");
      }
      expect(
        esquemaRecebimento(tipo).safeParse({ ...ok, metaDoConjuntoCentavos: null }).success,
        tipo,
      ).toBe(true);
    }
  });
  it("conjunto: só cavalo tem implementos, só implemento tem cavalo, sem repetir", () => {
    expect(
      esquemaDoCavalo.safeParse({
        ...ok,
        conjunto: { cavaloId: null, implementoIds: ["i1", "i2"] },
      }).success,
    ).toBe(true);
    expect(
      esquemaDoCavalo.safeParse({ ...ok, conjunto: { cavaloId: "c1", implementoIds: [] } }).success,
    ).toBe(false);
    expect(
      esquemaDoCavalo.safeParse({
        ...ok,
        conjunto: { cavaloId: null, implementoIds: ["i1", "i1"] },
      }).success,
    ).toBe(false);
    const doImplemento = esquemaRecebimento("implemento");
    expect(
      doImplemento.safeParse({ ...ok, conjunto: { cavaloId: "c1", implementoIds: [] } }).success,
    ).toBe(true);
    expect(
      doImplemento.safeParse({ ...ok, conjunto: { cavaloId: null, implementoIds: ["i1"] } })
        .success,
    ).toBe(false);
  });
});

describe("esquemaEnvioDeTransferencia: quem envia deixa o motivo e as pendências conhecidas", () => {
  const ok = {
    placa: "AAA0A00",
    paraGestorId: "gestor-2",
    motivo: "Troca de carteira entre filiais",
    pendenciasConhecidas: ["CRLV vence em 15 dias"],
  };
  it("aceita, com ou sem pendências", () => {
    expect(esquemaEnvioDeTransferencia.safeParse(ok).success).toBe(true);
    expect(esquemaEnvioDeTransferencia.safeParse({ ...ok, pendenciasConhecidas: [] }).success).toBe(
      true,
    );
  });
  it("o motivo é obrigatório e o destino também", () => {
    expect(esquemaEnvioDeTransferencia.safeParse({ ...ok, motivo: "  " }).success).toBe(false);
    expect(esquemaEnvioDeTransferencia.safeParse({ ...ok, paraGestorId: "" }).success).toBe(false);
  });
  it("pendência vazia não vale", () => {
    expect(
      esquemaEnvioDeTransferencia.safeParse({ ...ok, pendenciasConhecidas: [" "] }).success,
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
  it("modelo precisa da marca; garagem, da filial; CR, da operação", () => {
    expect(esquemaItemDeCatalogo.safeParse({ tipo: "modelo", nome: "FH 540" }).success).toBe(false);
    expect(
      esquemaItemDeCatalogo.safeParse({ tipo: "modelo", nome: "FH 540", paiId: "marca-volvo" })
        .success,
    ).toBe(true);
    expect(esquemaItemDeCatalogo.safeParse({ tipo: "garagem", nome: "Garagem 3" }).success).toBe(
      false,
    );
    expect(
      esquemaItemDeCatalogo.safeParse({ tipo: "garagem", nome: "Garagem 3", paiId: "filial-a" })
        .success,
    ).toBe(true);
    expect(esquemaItemDeCatalogo.safeParse({ tipo: "cr", nome: "CR-1006" }).success).toBe(false);
    expect(
      esquemaItemDeCatalogo.safeParse({ tipo: "cr", nome: "CR-1006", paiId: "op-1" }).success,
    ).toBe(true);
  });
  it("o CR segue o formato CR-0000", () => {
    for (const nome of ["1006", "CR1006", "CR-100", "CR-10066", "cr-1006"]) {
      const r = esquemaItemDeCatalogo.safeParse({ tipo: "cr", nome, paiId: "op-1" });
      expect(r.success, nome).toBe(false);
    }
  });
  it("o nome é obrigatório, sem espaços sobrando, de 2 a 60 caracteres", () => {
    expect(esquemaItemDeCatalogo.safeParse({ ...ok, nome: " " }).success).toBe(false);
    expect(esquemaItemDeCatalogo.safeParse({ ...ok, nome: "A" }).success).toBe(false);
    expect(esquemaItemDeCatalogo.safeParse({ ...ok, nome: "x".repeat(61) }).success).toBe(false);
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

describe("esquemaRecebimento: conjunto misto de carrocerias é bloqueado e o cavalo é o mestre", () => {
  const carrocerias = { "imp-1": "Sider", "imp-2": "Graneleiro", "imp-3": "Sider" };
  const ok = {
    placa: "AAA0A00",
    pedidoId: "ped-1",
    versaoDoPedido: 2,
    versaoDaPlaca: 3,
    conferido: true,
    situacao: "PÁT",
    operacaoId: null,
    crId: null,
    motoristaId: null,
    metaDoConjuntoCentavos: null,
    conjunto: { cavaloId: null, implementoIds: ["imp-1", "imp-3"] },
    pendencias: [],
  };
  const doCavalo = esquemaRecebimento("cavalo", carrocerias);
  it("implementos da mesma carroceria passam", () => {
    expect(doCavalo.safeParse(ok).success).toBe(true);
  });
  it("Sider com Graneleiro no mesmo cavalo é recusado, com o aviso no campo dos implementos", () => {
    const r = doCavalo.safeParse({
      ...ok,
      conjunto: { cavaloId: null, implementoIds: ["imp-1", "imp-2"] },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const achado = r.error.issues.find((i) => i.path.join(".") === "conjunto.implementoIds");
      expect(achado?.message).toContain("mesma carroceria");
    }
  });
  it("só o cavalo é mestre: implemento não leva implementos nem recebe meta, e cavalo não tem cavalo", () => {
    const doImplemento = esquemaRecebimento("implemento", carrocerias);
    expect(doImplemento.safeParse(ok).success).toBe(false);
    expect(
      doImplemento.safeParse({
        ...ok,
        conjunto: { cavaloId: "cav-1", implementoIds: [] },
        metaDoConjuntoCentavos: 1_000_00,
      }).success,
    ).toBe(false);
    expect(
      doCavalo.safeParse({ ...ok, conjunto: { cavaloId: "cav-1", implementoIds: [] } }).success,
    ).toBe(false);
  });
  it("sem a tabela de carrocerias, a regra do misto não roda (o resto do esquema vale)", () => {
    expect(
      esquemaRecebimento("cavalo").safeParse({
        ...ok,
        conjunto: { cavaloId: null, implementoIds: ["imp-1", "imp-2"] },
      }).success,
    ).toBe(true);
  });
});

describe("siglasIniciaisDoTipo: sai do catálogo da régua", () => {
  it("o apoio não tem SMo; cavalo e caminhão têm", () => {
    expect(siglasIniciaisDoTipo("apoio")).not.toContain("SMo");
    expect(siglasIniciaisDoTipo("cavalo")).toContain("SMo");
    expect(siglasIniciaisDoTipo("caminhao")).toContain("SMo");
    expect(siglasIniciaisDoTipo("implemento")).not.toContain("SMo");
    expect(siglasIniciaisDoTipo("equipamento")).not.toContain("SMo");
  });
  it("nenhuma sigla de operação, folga ou férias entra na situação inicial", () => {
    for (const tipo of ["cavalo", "implemento", "equipamento", "caminhao", "apoio"] as const) {
      const lista = siglasIniciaisDoTipo(tipo);
      for (const s of [
        "DOp",
        "ACe",
        "CAr",
        "CAn",
        "ETc",
        "ADe",
        "DEs",
        "ETv",
        "VAz",
        "FOg",
        "FEr",
        "MAc",
        "MAt",
        "MAv",
      ]) {
        expect(lista, `${tipo} ${s}`).not.toContain(s);
      }
    }
  });
});

describe("esquemaDisponibilizacaoDe: o tipo e a situação da placa decidem", () => {
  const entrada = { placa: "AAA0A00", filialId: "filial-a", versaoDaPlaca: 1 };
  it("cavalo e caminhão em PÁT, VAz ou ETv passam", () => {
    for (const tipo of ["cavalo", "caminhao"] as const) {
      for (const sigla of ["PÁT", "VAz", "ETv"] as const) {
        expect(
          esquemaDisponibilizacaoDe({ tipo, sigla }).safeParse(entrada).success,
          `${tipo} ${sigla}`,
        ).toBe(true);
      }
    }
  });
  it("carreta em PÁT é recusada, com a mensagem do tipo no campo da placa", () => {
    const r = esquemaDisponibilizacaoDe({ tipo: "implemento", sigla: "PÁT" }).safeParse(entrada);
    expect(r.success).toBe(false);
    if (!r.success) {
      const achado = r.error.issues.find((i) => i.path.join(".") === "placa");
      expect(achado?.message).toContain(
        "Só cavalo ou caminhão podem ser disponibilizados ao Operacional",
      );
    }
  });
  it("apoio e equipamento também; cavalo fora de PÁT, VAz e ETv recebe a mensagem da situação", () => {
    for (const tipo of ["apoio", "equipamento"] as const) {
      expect(
        esquemaDisponibilizacaoDe({ tipo, sigla: "PÁT" }).safeParse(entrada).success,
        tipo,
      ).toBe(false);
    }
    const r = esquemaDisponibilizacaoDe({ tipo: "cavalo", sigla: "MAN" }).safeParse(entrada);
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues.map((i) => i.message).join(" ")).toMatch(/PÁT, VAz ou ETv/);
  });
  it("o esquema base continua conferindo placa, filial e versão", () => {
    expect(esquemaDisponibilizacao.safeParse({ ...entrada, filialId: "" }).success).toBe(false);
    expect(
      esquemaDisponibilizacaoDe({ tipo: "cavalo", sigla: "PÁT" }).safeParse({
        ...entrada,
        versaoDaPlaca: 0,
      }).success,
    ).toBe(false);
  });
});
