import { describe, expect, it } from "vitest";
import { esquemaCadastrarPessoa, esquemaEditarPessoa, esquemaMarcarEscala } from "./pessoa";

// Dados fictícios (o CPF é um exemplo válido só pelo dígito verificador).
const OPERACAO = "2f6c1c55-3a8e-4a57-9a0b-6f1d2b7c9e10";
const PESSOA = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

describe("esquemaCadastrarPessoa", () => {
  const valido = {
    nome: "  Pessoa Fictícia ",
    cpf: "529.982.247-25",
    email: "",
    operacaoId: OPERACAO,
    funcao: "motorista",
    inicio: "2026-03-01",
  };
  it("aceita o cadastro com vínculo e devolve o CPF só com dígitos e o nome aparado", () => {
    const r = esquemaCadastrarPessoa.parse(valido);
    expect(r.cpf).toBe("52998224725");
    expect(r.nome).toBe("Pessoa Fictícia");
  });
  it("aceita sem vínculo (operação vazia), sem pedir função nem início", () => {
    expect(
      esquemaCadastrarPessoa.safeParse({ ...valido, operacaoId: "", funcao: "", inicio: "" })
        .success,
    ).toBe(true);
  });
  it("recusa CPF inválido no campo cpf", () => {
    const r = esquemaCadastrarPessoa.safeParse({ ...valido, cpf: "529.982.247-24" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["cpf"]);
  });
  it("com operação, exige a função e o início", () => {
    const r = esquemaCadastrarPessoa.safeParse({ ...valido, funcao: "", inicio: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["funcao", "inicio"]);
  });
  it("recusa e-mail mal escrito, aceita vazio", () => {
    expect(esquemaCadastrarPessoa.safeParse({ ...valido, email: "sem-arroba" }).success).toBe(
      false,
    );
    expect(
      esquemaCadastrarPessoa.safeParse({ ...valido, email: "pessoa@exemplo.local" }).success,
    ).toBe(true);
  });
});

describe("esquemaEditarPessoa", () => {
  const valido = {
    id: PESSOA,
    versao: 2,
    nome: "Pessoa Fictícia",
    email: "",
    operacaoId: OPERACAO,
    funcao: "operador",
    inicio: "",
  };
  it("aceita sem a data quando o vínculo não muda (o banco decide se mudou)", () => {
    expect(esquemaEditarPessoa.safeParse(valido).success).toBe(true);
  });
  it("exige a versão vista", () => {
    expect(esquemaEditarPessoa.safeParse({ ...valido, versao: 0 }).success).toBe(false);
  });
  it("com operação, exige a função", () => {
    const r = esquemaEditarPessoa.safeParse({ ...valido, funcao: "" });
    expect(r.error?.issues[0]?.path).toEqual(["funcao"]);
  });
});

describe("esquemaMarcarEscala", () => {
  const valido = {
    pessoaId: PESSOA,
    operacaoId: OPERACAO,
    dia: "2026-06-01",
    sigla: "FE",
    versao: null,
  };
  it("aceita as quatro siglas e a versão nula (dia sem marcação)", () => {
    for (const sigla of ["T", "F", "FE", "AT"]) {
      expect(esquemaMarcarEscala.safeParse({ ...valido, sigla }).success).toBe(true);
    }
  });
  it("recusa sigla desconhecida e dia mal escrito", () => {
    expect(esquemaMarcarEscala.safeParse({ ...valido, sigla: "X" }).success).toBe(false);
    expect(esquemaMarcarEscala.safeParse({ ...valido, dia: "01/06/2026" }).success).toBe(false);
  });
});
