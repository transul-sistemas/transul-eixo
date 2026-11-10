import { describe, expect, it } from "vitest";
import { lerPessoas } from "@/lib/navegacao/pessoas";
import {
  cadastrarPessoa,
  type ClienteDasPessoas,
  editarPessoa,
  lerEscalaDoMes,
  lerPessoasDaLista,
  marcarEscala,
} from "./pessoas";

// Dados fictícios. O banco filtra, pagina e confere; aqui só se confere a chamada e a conversão.
function clienteCom(data: unknown, error: { message: string; code?: string } | null = null) {
  const chamadas: { funcao: string; argumentos?: Record<string, unknown> }[] = [];
  const cliente: ClienteDasPessoas = {
    schema: () => ({
      rpc: (funcao, argumentos) => {
        chamadas.push({ funcao, argumentos });
        return Promise.resolve({ data, error });
      },
    }),
  };
  return { cliente: () => Promise.resolve(cliente), cru: cliente, chamadas };
}

const OPERACAO = "2f6c1c55-3a8e-4a57-9a0b-6f1d2b7c9e10";
const PESSOA = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

describe("lerPessoasDaLista", () => {
  it("passa busca, chips, operação, ordem e página ao banco e converte a linha", async () => {
    const { cliente, chamadas } = clienteCom({
      linhas: [
        {
          id: PESSOA,
          nome: "Pessoa Fictícia",
          documento_mascarado: "***.982.247-**",
          situacao: "com_vinculo",
          funcao: "motorista",
          funcao_nome: "Motorista",
          operacao_id: OPERACAO,
          operacao: "Operação Fictícia",
          desde: "2026-03-01",
        },
      ],
      filtradas: 1,
      pagina: 1,
      paginas: 1,
      tam: 50,
      chips: { com_vinculo: 1 },
      operacoes: [{ id: OPERACAO, nome: "Operação Fictícia" }],
    });
    const r = await lerPessoasDaLista(
      lerPessoas(
        new URLSearchParams(`q=fic&chip=motorista&operacao=${OPERACAO}&ordem=-desde&pagina=2`),
      ),
      cliente,
    );
    expect(chamadas).toEqual([
      {
        funcao: "pessoas_da_lista",
        argumentos: {
          p_busca: "fic",
          p_chips: ["motorista"],
          p_operacao: OPERACAO,
          p_ordem: "-desde",
          p_pagina: 2,
          p_tam: 50,
        },
      },
    ]);
    expect(r.linhas[0]).toMatchObject({
      documentoMascarado: "***.982.247-**",
      funcaoNome: "Motorista",
      operacao: "Operação Fictícia",
    });
  });
  it("erro do banco vira exceção (a tela mostra o erro com tentar de novo)", async () => {
    const { cliente } = clienteCom(null, { message: "falhou", code: "XX000" });
    await expect(lerPessoasDaLista(lerPessoas(new URLSearchParams()), cliente)).rejects.toThrow(
      "pessoas_da_lista",
    );
  });
});

describe("lerEscalaDoMes", () => {
  it("passa a operação e o mês e devolve o mês como aaaa-mm", async () => {
    const { cliente, chamadas } = clienteCom({
      mes: "2026-06-01",
      dias_no_mes: 30,
      operacao: { id: OPERACAO, nome: "Operação Fictícia" },
      operacoes: [],
      pode_marcar: true,
      pessoas: [
        {
          id: PESSOA,
          nome: "Pessoa Fictícia",
          funcao_nome: "Motorista",
          periodos: [{ inicio: "2026-03-01", fim: null }],
          dias: { "2026-06-01": { sigla: "F", versao: 1 } },
        },
      ],
      totais: { pessoas: 1, T: 0, F: 1, FE: 0, AT: 0 },
    });
    const r = await lerEscalaDoMes({ operacao: OPERACAO, mes: "2026-06" }, cliente);
    expect(chamadas[0]).toEqual({
      funcao: "escala_do_mes",
      argumentos: { p_operacao: OPERACAO, p_mes: "2026-06-01" },
    });
    expect(r.mes).toBe("2026-06");
    expect(r.pessoas[0]?.dias["2026-06-01"]?.sigla).toBe("F");
  });
});

describe("gravações", () => {
  const cadastro = {
    nome: "Pessoa Fictícia",
    cpf: "52998224725",
    email: "",
    operacaoId: "",
    funcao: "" as const,
    inicio: "2026-03-01",
  };
  it("cadastrar sem operação não manda função nem início", async () => {
    const { cru, chamadas } = clienteCom({ id: PESSOA, nome: "Pessoa Fictícia", versao: 1 });
    const r = await cadastrarPessoa(cru, cadastro);
    expect(r).toEqual({ ok: true, linha: { id: PESSOA, nome: "Pessoa Fictícia", versao: 1 } });
    expect(chamadas[0]?.argumentos).toMatchObject({
      p_documento: "52998224725",
      p_email: null,
      p_operacao: null,
      p_funcao: null,
      p_inicio: null,
    });
  });
  it("CPF repetido (23505) vira erro no campo CPF", async () => {
    const { cru } = clienteCom(null, {
      message: "Já existe uma pessoa com este CPF.",
      code: "23505",
    });
    const r = await cadastrarPessoa(cru, cadastro);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.campos?.cpf).toEqual(["Já existe uma pessoa com este CPF."]);
  });
  it("editar com versão velha (40001) vira conflito", async () => {
    const { cru } = clienteCom(null, { message: "mudou", code: "40001" });
    const r = await editarPessoa(cru, {
      id: PESSOA,
      versao: 1,
      nome: "Pessoa Fictícia",
      email: "",
      operacaoId: OPERACAO,
      funcao: "motorista",
      inicio: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("conflito");
  });
  it("marcar fora do vínculo (22023) vira entrada inválida com a mensagem do banco", async () => {
    const { cru } = clienteCom(null, { message: "A pessoa não está vinculada.", code: "22023" });
    const r = await marcarEscala(cru, {
      pessoaId: PESSOA,
      operacaoId: OPERACAO,
      dia: "2026-06-01",
      sigla: "T",
      versao: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro.codigo).toBe("entrada_invalida");
      expect(r.erro.mensagem).toBe("A pessoa não está vinculada.");
    }
  });
});
