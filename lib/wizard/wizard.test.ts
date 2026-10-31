import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  chaveDoRascunho,
  apagarRascunho,
  guardarRascunho,
  lerRascunho,
  type ArmazemDeRascunho,
} from "./rascunho";
import {
  erroDaAcao,
  errosDeCampos,
  MENSAGENS_PADRAO,
  sucesso,
  type CodigoDeErro,
} from "./resultado";
import { chaveDeEnvioValida, novaChaveDeEnvio } from "./chave-de-envio";
import {
  indiceDoPrimeiroPassoComErro,
  passoSeguinte,
  passoAnterior,
  podeAvancar,
  progresso,
  validarDefinicao,
  type DefinicaoDeAssistente,
} from "./passos";

const definicao: DefinicaoDeAssistente = {
  id: "cadastrar-placa",
  titulo: "Cadastrar placa",
  versaoDoEsquema: 1,
  passos: [
    { id: "identificacao", titulo: "Identificação", campos: ["placa", "renavam", "tipo"] },
    { id: "veiculo", titulo: "Veículo", campos: ["marca", "modelo", "ano"] },
    { id: "valor", titulo: "Valor", campos: ["codigoFipe", "valorFipeCentavos", "fonteDoValor"] },
    { id: "posse", titulo: "Posse", campos: ["gestorId", "operacaoId", "crId"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

describe("passos: avançar só com o passo válido, e erro leva ao primeiro passo com erro", () => {
  it("um passo sem erro nos seus campos pode avançar", () => {
    expect(podeAvancar(definicao.passos, 0, [])).toBe(true);
    expect(podeAvancar(definicao.passos, 0, ["marca"])).toBe(true); // erro em campo de outro passo
  });
  it("um passo com erro em algum campo seu não avança", () => {
    expect(podeAvancar(definicao.passos, 0, ["renavam"])).toBe(false);
    expect(podeAvancar(definicao.passos, 1, ["modelo", "ano"])).toBe(false);
  });
  it("o caminho do campo aninhado conta pelo campo de cima (conjunto.implementoIds)", () => {
    const passos = [{ id: "a", titulo: "A", campos: ["conjunto"] }];
    expect(podeAvancar(passos, 0, ["conjunto.implementoIds"])).toBe(false);
  });
  it("o passo de conferir (sem campos) sempre pode avançar", () => {
    expect(podeAvancar(definicao.passos, 4, ["placa"])).toBe(true);
  });
  it("devolve o primeiro passo que tem erro, na ordem da tela", () => {
    expect(indiceDoPrimeiroPassoComErro(definicao.passos, ["crId", "marca", "renavam"])).toBe(0);
    expect(indiceDoPrimeiroPassoComErro(definicao.passos, ["crId", "ano"])).toBe(1);
    expect(indiceDoPrimeiroPassoComErro(definicao.passos, ["crId"])).toBe(3);
  });
  it("sem erro, ou erro em campo que nenhum passo conhece, devolve nulo", () => {
    expect(indiceDoPrimeiroPassoComErro(definicao.passos, [])).toBeNull();
    expect(indiceDoPrimeiroPassoComErro(definicao.passos, ["campoQueNaoExiste"])).toBeNull();
  });
  it("anterior e seguinte ficam entre o primeiro e o último passo", () => {
    expect(passoAnterior(0)).toBe(0);
    expect(passoAnterior(3)).toBe(2);
    expect(passoSeguinte(0, 5)).toBe(1);
    expect(passoSeguinte(4, 5)).toBe(4);
  });
  it("o progresso é o passo atual de N, com percentual inteiro", () => {
    expect(progresso(0, 5)).toEqual({ atual: 1, total: 5, percentual: 20 });
    expect(progresso(4, 5)).toEqual({ atual: 5, total: 5, percentual: 100 });
    expect(progresso(0, 3)).toEqual({ atual: 1, total: 3, percentual: 33 });
  });
  it("a definição confere: passos com id único, campos que não se repetem entre passos", () => {
    expect(validarDefinicao(definicao)).toEqual([]);
    expect(
      validarDefinicao({
        ...definicao,
        passos: [definicao.passos[0]!, { ...definicao.passos[1]!, id: "identificacao" }],
      }),
    ).toContain("passo repetido: identificacao");
    expect(
      validarDefinicao({
        ...definicao,
        passos: [
          { id: "a", titulo: "A", campos: ["placa"] },
          { id: "b", titulo: "B", campos: ["placa"] },
        ],
      }),
    ).toContain("campo em mais de um passo: placa");
    expect(validarDefinicao({ ...definicao, passos: [] })).toContain("sem passos");
  });
});

const valores = { placa: "AAA0A00", marca: "Volvo", gestorId: "g1", renavam: "00639884962" };
const validarValores = (v: unknown) => {
  const r = z.object({ placa: z.string(), marca: z.string() }).partial().safeParse(v);
  return r.success ? r.data : null;
};

function armazemFalso(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  const a: ArmazemDeRascunho & { dados: Map<string, string> } = {
    dados,
    getItem: (k) => dados.get(k) ?? null,
    setItem: (k, v) => void dados.set(k, v),
    removeItem: (k) => void dados.delete(k),
  };
  return a;
}
const armazemQueLanca: ArmazemDeRascunho = {
  getItem: () => {
    throw new Error("bloqueado");
  },
  setItem: () => {
    throw new Error("cheio");
  },
  removeItem: () => {
    throw new Error("bloqueado");
  },
};

describe("rascunho: por pessoa e navegador, validado na leitura, sem dados sensíveis", () => {
  const chave = chaveDoRascunho("usuario-1", "cadastrar-placa");

  it("a chave é por pessoa, por assistente e por registro", () => {
    expect(chave).toBe("eixo-rascunho:usuario-1:cadastrar-placa:novo");
    expect(chaveDoRascunho("usuario-1", "receber-placa", "ped-9")).toBe(
      "eixo-rascunho:usuario-1:receber-placa:ped-9",
    );
    expect(chaveDoRascunho("usuario-2", "cadastrar-placa")).not.toBe(chave);
  });

  it("guarda e lê o rascunho de volta (valores e passo)", () => {
    const a = armazemFalso();
    expect(guardarRascunho(a, chave, { versaoDoEsquema: 1, passo: 2, valores })).toBe("salvo");
    expect(lerRascunho(a, chave, { versaoDoEsquema: 1, validar: validarValores })).toEqual({
      tipo: "rascunho",
      passo: 2,
      valores: { placa: "AAA0A00", marca: "Volvo" },
    });
  });

  it("não guarda os campos sensíveis pedidos", () => {
    const a = armazemFalso();
    guardarRascunho(a, chave, {
      versaoDoEsquema: 1,
      passo: 0,
      valores,
      camposSensiveis: ["renavam", "gestorId"],
    });
    const bruto = a.dados.get(chave) ?? "";
    expect(bruto).not.toContain("renavam");
    expect(bruto).not.toContain("00639884962");
    expect(bruto).not.toContain("gestorId");
  });

  it("sem rascunho devolve 'nenhum'", () => {
    expect(
      lerRascunho(armazemFalso(), chave, { versaoDoEsquema: 1, validar: validarValores }),
    ).toEqual({ tipo: "nenhum" });
  });

  it("rascunho de versão antiga do esquema é descartado, com aviso, e apagado", () => {
    const a = armazemFalso();
    guardarRascunho(a, chave, { versaoDoEsquema: 1, passo: 1, valores });
    expect(lerRascunho(a, chave, { versaoDoEsquema: 2, validar: validarValores })).toEqual({
      tipo: "descartado",
      motivo: "versao",
    });
    expect(a.dados.has(chave)).toBe(false);
  });

  it("rascunho estragado nunca quebra: texto que não é JSON, formato errado, valores inválidos", () => {
    for (const bruto of [
      "",
      "abc",
      "null",
      "[]",
      "{}",
      '{"versaoDoEsquema":1}',
      '{"versaoDoEsquema":1,"passo":-1,"valores":{}}',
      '{"versaoDoEsquema":1,"passo":0,"valores":5}',
    ]) {
      const a = armazemFalso({ [chave]: bruto });
      const r = lerRascunho(a, chave, { versaoDoEsquema: 1, validar: validarValores });
      expect(r.tipo, bruto).toBe("descartado");
      expect(a.dados.has(chave), bruto).toBe(false);
    }
    const a = armazemFalso({
      [chave]: JSON.stringify({ versaoDoEsquema: 1, passo: 0, valores: { placa: 5 } }),
    });
    expect(lerRascunho(a, chave, { versaoDoEsquema: 1, validar: validarValores }).tipo).toBe(
      "descartado",
    );
  });

  it("armazenamento bloqueado ou cheio: sem rascunho, sem exceção", () => {
    expect(guardarRascunho(armazemQueLanca, chave, { versaoDoEsquema: 1, passo: 0, valores })).toBe(
      "indisponivel",
    );
    expect(
      lerRascunho(armazemQueLanca, chave, { versaoDoEsquema: 1, validar: validarValores }),
    ).toEqual({ tipo: "nenhum" });
    expect(() => apagarRascunho(armazemQueLanca, chave)).not.toThrow();
  });

  it("sem armazenamento (nulo): o assistente funciona sem rascunho", () => {
    expect(guardarRascunho(null, chave, { versaoDoEsquema: 1, passo: 0, valores })).toBe(
      "indisponivel",
    );
    expect(lerRascunho(null, chave, { versaoDoEsquema: 1, validar: validarValores })).toEqual({
      tipo: "nenhum",
    });
  });

  it("rascunho grande demais não é guardado (limite de 20 mil caracteres)", () => {
    const a = armazemFalso();
    const enorme = { placa: "x".repeat(25_000) };
    expect(guardarRascunho(a, chave, { versaoDoEsquema: 1, passo: 0, valores: enorme })).toBe(
      "indisponivel",
    );
    expect(a.dados.size).toBe(0);
  });

  it("apagar remove o rascunho", () => {
    const a = armazemFalso();
    guardarRascunho(a, chave, { versaoDoEsquema: 1, passo: 0, valores });
    apagarRascunho(a, chave);
    expect(a.dados.has(chave)).toBe(false);
  });
});

describe("resultado da ação: linha ou erro tipado", () => {
  const codigos: CodigoDeErro[] = [
    "entrada_invalida",
    "sem_permissao",
    "placa_ja_existe",
    "conflito",
    "nao_encontrado",
    "falha",
  ];
  it("sucesso devolve a linha gravada", () => {
    expect(sucesso({ id: "1", placa: "AAA0A00" })).toEqual({
      ok: true,
      linha: { id: "1", placa: "AAA0A00" },
    });
  });
  it("todo código de erro tem mensagem padrão em português, sem pedir desculpas", () => {
    for (const codigo of codigos) {
      const mensagem = MENSAGENS_PADRAO[codigo];
      expect(mensagem, codigo).toBeTruthy();
      expect(mensagem.endsWith("."), codigo).toBe(true);
      expect(mensagem.toLowerCase(), codigo).not.toMatch(/desculp|infelizmente|oops|ops/);
    }
  });
  it("o erro carrega código, mensagem e, se houver, a linha atual (conflito) ou os campos", () => {
    expect(erroDaAcao("conflito", { atual: { versao: 4 } })).toEqual({
      ok: false,
      erro: { codigo: "conflito", mensagem: MENSAGENS_PADRAO.conflito, atual: { versao: 4 } },
    });
    expect(erroDaAcao("falha", { mensagem: "Servidor sem resposta." }).erro.mensagem).toBe(
      "Servidor sem resposta.",
    );
  });
  it("erros de campos: caminho com pontos, várias mensagens por campo, na ordem", () => {
    const r = z
      .object({ placa: z.string().min(3, "Curta."), conjunto: z.object({ cavaloId: z.string() }) })
      .safeParse({ placa: "a", conjunto: {} });
    expect(r.success).toBe(false);
    if (!r.success) {
      const campos = errosDeCampos(r.error);
      expect(campos.placa).toEqual(["Curta."]);
      expect(Object.keys(campos)).toContain("conjunto.cavaloId");
      expect(erroDaAcao("entrada_invalida", { campos }).erro.campos).toBe(campos);
    }
  });
});

describe("chave de envio: o clique duplo e a nova tentativa mandam a mesma chave", () => {
  it("é um UUID e cada chamada gera uma chave diferente", () => {
    const a = novaChaveDeEnvio();
    const b = novaChaveDeEnvio();
    expect(chaveDeEnvioValida(a)).toBe(true);
    expect(a).not.toBe(b);
  });
  it("aceita um gerador de fora (teste e servidor)", () => {
    expect(novaChaveDeEnvio(() => "11111111-1111-4111-8111-111111111111")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });
  it("recusa o que não é UUID", () => {
    for (const t of [
      "",
      "abc",
      "1234",
      "11111111-1111-1111-1111-11111111111",
      null,
      undefined,
      5,
    ]) {
      expect(chaveDeEnvioValida(t), String(t)).toBe(false);
    }
  });
});
