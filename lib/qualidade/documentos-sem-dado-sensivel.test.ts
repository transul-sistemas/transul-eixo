import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Achados,
  achadosNoDocumento,
  documentosVarridos,
  lerAchados,
} from "./documentos-sem-dado-sensivel";

// REGRA DE 11/11/2026 (Alexandre; docs/auditoria-de-exposicao.md): o repositório é público, e a documentação não
// leva CPF, CNPJ, chave, nome de pessoa, de acionista nem de cliente; valores reais de receita, despesa ou margem
// só em percentual ou fictício. CPF, CNPJ e chave são proibidos sem exceção. O dinheiro grande tem uma LISTA DE
// PENDÊNCIAS DE SANITIZAÇÃO (os documentos de hoje que ainda têm valor real): como a da lista de vinte e a do
// olhinho, ela só encolhe: o teste também falha quando um documento passa a ter menos do que a lista diz, para
// ela baixar; documento fora da lista não pode ter nenhum.
const PENDENCIAS_DE_SANITIZACAO: Record<string, number> = {
  // Receita de CT-e e de NFS-e de dois meses, total e por série (seção "Onde o Eixo ainda diverge").
  "docs/cr-regras.md": 14,
  // Custo absorvido por carretas cedidas, receita de NFS-e e de CT-e sem acerto, receita da série V.
  "docs/v1-frutos-e-licoes.md": 5,
  // Um valor abreviado na seção "Identidade visual" (provável falso positivo; conferir).
  "docs/projeto-tecnico.md": 1,
};

// Os exemplos são montados na hora: o código do teste não carrega o padrão que ele proíbe.
const cpf = ["123", "456", "789"].join(".") + "-09";
const cnpj = ["12", "345", "678"].join(".") + "/0001-95";
const jwt = `eyJ${"a".repeat(12)}.eyJ${"b".repeat(12)}.${"c".repeat(12)}`;
const sb = "sb_" + "secret_" + "a".repeat(20);
const privada = "-----BEGIN " + "RSA PRIVATE KEY" + "-----";
const ghp = "ghp_" + "A".repeat(36);
const conexao = (senha: string) =>
  "postgresql://" + "usuario" + ":" + senha + "@" + "banco.exemplo.net/db";
const atribuicao = (nome: string, valor: string) => `${nome} = "${valor}"`;
const zero: Achados = { cpf: 0, cnpj: 0, chave: 0, dinheiroGrande: 0 };
const so = (parcial: Partial<Achados>): Achados => ({ ...zero, ...parcial });

describe("achadosNoDocumento: o que o detector reconhece (só contagem)", () => {
  it("texto comum não acha nada, nem número parecido, nem dinheiro pequeno", () => {
    expect(
      achadosNoDocumento("Placa ZDM1A01, 978 placas, 20 por página, R$ 8.400 e R$ 12,50 em 2026."),
    ).toEqual(zero);
  });

  it("CPF formatado e CPF solto depois da palavra CPF", () => {
    expect(achadosNoDocumento(`documento ${cpf}`)).toEqual(so({ cpf: 1 }));
    expect(achadosNoDocumento("o CPF 12345678909 da pessoa")).toEqual(so({ cpf: 1 }));
    expect(achadosNoDocumento("o número 12345678909 sem a palavra não é CPF")).toEqual(zero);
  });

  it("CNPJ formatado", () => {
    expect(achadosNoDocumento(`empresa ${cnpj}`)).toEqual(so({ cnpj: 1 }));
  });

  it("chave com formato próprio: JWT, sb_, chave privada e token de GitHub", () => {
    for (const chave of [jwt, sb, privada, ghp]) {
      expect(achadosNoDocumento(`valor ${chave} fim`), chave.slice(0, 6)).toEqual(so({ chave: 1 }));
    }
  });

  it("string de conexão: com senha de verdade conta; com marcador no lugar da senha, não", () => {
    expect(achadosNoDocumento(conexao("Zk8qLm2Pw9Tr"))).toEqual(so({ chave: 1 }));
    expect(achadosNoDocumento(conexao("SENHA"))).toEqual(zero);
    expect(achadosNoDocumento(conexao("[YOUR-PASSWORD]"))).toEqual(zero);
  });

  it("atribuição de senha ou segredo: valor literal conta; marcador não", () => {
    expect(achadosNoDocumento(atribuicao("client_secret", "Zk8qLm2Pw9TrXv7B"))).toEqual(
      so({ chave: 1 }),
    );
    expect(achadosNoDocumento(atribuicao("api_key", "x".repeat(16) + "xxx"))).toEqual(zero);
    expect(achadosNoDocumento(atribuicao("senha", "seu_valor_aqui"))).toEqual(zero);
  });

  it("dinheiro grande: valor completo a partir de dez mil reais e valor abreviado em mi, mil e bi", () => {
    expect(achadosNoDocumento("a receita foi de R$ 45.919.374,89 no mês")).toEqual(
      so({ dinheiroGrande: 1 }),
    );
    expect(achadosNoDocumento("R$ 10.000 e R$ 99.999,99")).toEqual(so({ dinheiroGrande: 2 }));
    expect(achadosNoDocumento("R$ 9.999,99 ainda é pequeno")).toEqual(zero);
    expect(achadosNoDocumento("custou R$ 2,6 mi, R$ 12,8 mil e R$ 1 bi")).toEqual(
      so({ dinheiroGrande: 3 }),
    );
    expect(achadosNoDocumento("R$ 3 milhões")).toEqual(so({ dinheiroGrande: 1 }));
    expect(achadosNoDocumento("R$ 5 mínimo")).toEqual(zero);
  });

  it("valor em percentual ou em palavras não conta", () => {
    expect(achadosNoDocumento("cerca de 5% da receita, entre um e cinco milhões de reais")).toEqual(
      zero,
    );
  });
});

describe("documentos reais: sem CPF, CNPJ nem chave; dinheiro grande só na lista de pendências", () => {
  const documentos = documentosVarridos();

  it("varre os documentos (docs/**.md e CLAUDE.md), sem os protótipos", () => {
    expect(documentos.length).toBeGreaterThan(20);
    expect(documentos).toContain("CLAUDE.md");
    expect(documentos).toContain("docs/decisoes.md");
    expect(documentos.some((c) => c.startsWith("docs/prototipos/"))).toBe(false);
  });

  it("nenhum documento tem padrão de CPF, de CNPJ ou de chave", () => {
    const com = documentos
      .map((c) => ({ c, a: lerAchados(c) }))
      .filter(({ a }) => a.cpf + a.cnpj + a.chave > 0)
      .map(({ c, a }) => `${c}: cpf ${a.cpf}, cnpj ${a.cnpj}, chave ${a.chave}`);
    expect(com).toEqual([]);
  });

  it("o dinheiro grande só está na lista de pendências, e a lista só encolhe", () => {
    const fora: string[] = [];
    for (const c of documentos) {
      const n = lerAchados(c).dinheiroGrande;
      const limite = PENDENCIAS_DE_SANITIZACAO[c] ?? 0;
      if (n > limite) fora.push(`${c}: ${n} valores, a lista permite ${limite}`);
      if (limite > 0 && n < limite)
        fora.push(`${c}: agora tem ${n}; baixe a lista de ${limite} para ${n}`);
    }
    expect(fora).toEqual([]);
  });

  it("a lista de pendências só tem documentos que existem", () => {
    for (const c of Object.keys(PENDENCIAS_DE_SANITIZACAO)) expect(existsSync(c), c).toBe(true);
  });
});
