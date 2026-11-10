import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PREFIXO_DA_PLACA_DEMO,
  abastecimentosDaDemo,
  cnpjFicticio,
  codcencusDemo,
  cpfFicticio,
  diaDaEscala,
  ehCnpjDaDemo,
  ehCpfDaDemo,
  exigirBancoLocalParaDemo,
  nomeDeDemo,
  placaDemo,
  planoDasPessoas,
  somarDias,
} from "./demo-dados";

// Dados de demonstração (10/11/2026): só no banco LOCAL, sempre fictícios e marcados. Estas regras
// protegem o resto do sistema: nada disto entra em migration nem no seed.

function validaCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

function validaCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj)) return false;
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((s, p, i) => s + p * Number(cnpj[i]), 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(cnpj[12]) && dv(13) === Number(cnpj[13]);
}

describe("exigirBancoLocalParaDemo: só o banco da própria máquina", () => {
  it("aceita o banco local", () => {
    expect(() =>
      exigirBancoLocalParaDemo("postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
    ).not.toThrow();
  });
  it.each([
    "postgresql://postgres.abc:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres",
    "postgresql://postgres:senha@db.kbyhojdrpzdylexmlsip.supabase.co:5432/postgres",
    "não é endereço",
    "",
  ])("recusa %s", (endereco) => {
    expect(() => exigirBancoLocalParaDemo(endereco)).toThrow(/só rodam no Supabase local/);
  });
});

describe("CPF e CNPJ fictícios", () => {
  it("o CPF tem dígitos verificadores válidos e fica na faixa da demonstração", () => {
    for (let n = 1; n <= 300; n++) {
      const cpf = cpfFicticio(n);
      expect(validaCpf(cpf)).toBe(true);
      expect(ehCpfDaDemo(cpf)).toBe(true);
    }
  });
  it("é determinístico e sem repetição", () => {
    expect(cpfFicticio(7)).toBe(cpfFicticio(7));
    const todos = new Set(Array.from({ length: 300 }, (_, i) => cpfFicticio(i + 1)));
    expect(todos.size).toBe(300);
  });
  it("recusa número fora da faixa reservada", () => {
    expect(() => cpfFicticio(0)).toThrow();
    expect(() => cpfFicticio(1000)).toThrow();
  });
  it("o CNPJ é válido e fica na faixa da demonstração", () => {
    for (let n = 1; n <= 20; n++) {
      const cnpj = cnpjFicticio(n);
      expect(validaCnpj(cnpj)).toBe(true);
      expect(ehCnpjDaDemo(cnpj)).toBe(true);
    }
    expect(cnpjFicticio(3)).toBe(cnpjFicticio(3));
  });
  it("CPF de gente real não cai na faixa", () => {
    expect(ehCpfDaDemo("52998224725")).toBe(false);
    expect(ehCnpjDaDemo("11222333000181")).toBe(false);
  });
});

describe("CR da demonstração", () => {
  it("tem 7 dígitos, raiz 2, 4 ou 6 e é único", () => {
    const todos = Array.from({ length: 100 }, (_, i) => codcencusDemo(i + 1));
    expect(new Set(todos).size).toBe(100);
    for (const c of todos) expect(String(c)).toMatch(/^[246]99[0-9]{4}$/);
    expect(() => codcencusDemo(101)).toThrow();
  });
});

describe("placas do bloco reservado", () => {
  it("são Mercosul, únicas e todas com o prefixo da demonstração", () => {
    const placas = Array.from({ length: 2600 }, (_, i) => placaDemo(i + 1));
    expect(new Set(placas).size).toBe(2600);
    for (const p of placas) {
      expect(p).toMatch(/^ZDM[0-9][A-Z][0-9]{2}$/);
      expect(p.startsWith(PREFIXO_DA_PLACA_DEMO)).toBe(true);
    }
  });
  it("recusa número fora do bloco", () => {
    expect(() => placaDemo(0)).toThrow();
    expect(() => placaDemo(2601)).toThrow();
  });
});

describe("pessoas, escala e abastecimento: mesma entrada, mesmos dados", () => {
  it("o nome sempre leva a marca Demo", () => {
    for (let i = 0; i < 80; i++) expect(nomeDeDemo(i)).toMatch(/^Demo /);
  });
  it("o plano de 60 pessoas é igual a cada geração e usa CPF da faixa", () => {
    const a = planoDasPessoas("2026-11-10", 60, 7);
    const b = planoDasPessoas("2026-11-10", 60, 7);
    expect(a).toEqual(b);
    expect(a).toHaveLength(60);
    expect(new Set(a.map((p) => p.cpf)).size).toBe(60);
    for (const p of a) {
      expect(ehCpfDaDemo(p.cpf)).toBe(true);
      expect(p.nome).toMatch(/^Demo /);
      expect(p.operacaoIndice).toBeLessThan(7);
    }
  });
  it("a escala é determinística e só usa as quatro marcações", () => {
    const dias = Array.from({ length: 40 }, (_, i) => somarDias("2026-10-01", i));
    const a = dias.map((d) => diaDaEscala(5, d));
    expect(a).toEqual(dias.map((d) => diaDaEscala(5, d)));
    for (const s of a) expect(["T", "F", "FE", "AT"]).toContain(s);
    expect(a).toContain("T");
    expect(a).toContain("F");
  });
  it("o abastecimento tem litros e km válidos, três meses, e a chave de origem é estável", () => {
    const placas = ["ZDM0A01", "ZDM0A02"];
    const a = abastecimentosDaDemo("2026-11-10", placas);
    expect(a).toEqual(abastecimentosDaDemo("2026-11-10", placas));
    expect(new Set(a.map((x) => x.origemId)).size).toBe(a.length);
    expect(new Set(a.map((x) => x.data.slice(0, 7)))).toEqual(
      new Set(["2026-08", "2026-09", "2026-10"]),
    );
    for (const x of a) {
      expect(x.litros).toBeGreaterThan(0);
      expect(x.kmFinal).toBeGreaterThan(x.kmInicial);
      expect(x.origemId.startsWith("DEMO-")).toBe(true);
      expect(x.origem).toBe("demo");
    }
  });
  it("somarDias passa por fim de mês e de ano", () => {
    expect(somarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("a demonstração nunca entra em migration nem no seed", () => {
  const arquivos = [
    ...readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .map((f) => `supabase/migrations/${f}`),
    "supabase/seed.sql",
  ];
  const cpfs = Array.from({ length: 999 }, (_, i) => cpfFicticio(i + 1));
  const cnpjs = Array.from({ length: 30 }, (_, i) => cnpjFicticio(i + 1));
  it.each(arquivos)("%s", (arquivo) => {
    const texto = readFileSync(arquivo, "utf8");
    expect(texto).not.toMatch(/\bDemo\b/);
    expect(texto).not.toMatch(/ZDM[0-9][A-Z][0-9]{2}/);
    expect(texto).not.toMatch(/ZDM/);
    expect(texto).not.toMatch(/origem\s*=\s*'demo'/);
    for (const doc of [...cpfs, ...cnpjs]) expect(texto.includes(doc)).toBe(false);
  });
});
