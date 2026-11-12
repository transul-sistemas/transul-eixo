import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PREFIXO_DA_PLACA_DEMO,
  abastecimentosDaDemo,
  NUMEROS_DOS_CENARIOS,
  PRAZO_DE_RECEBER_EM_DIAS,
  TROCA_RECENTE_EM_DIAS,
  cavaloEmConjunto,
  pedidoAtrasado,
  planoDosPedidos,
  planoDosVinculos,
  roteiroDoMovimento,
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
    const pesos =
      n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
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
    const todos = Array.from({ length: 300 }, (_, i) => codcencusDemo(i + 1));
    expect(new Set(todos).size).toBe(300);
    for (const c of todos) expect(String(c)).toMatch(/^[246]99[0-9]{4}$/);
    expect(() => codcencusDemo(301)).toThrow();
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

describe("cenários de observação (12/11/2026)", () => {
  it("o prazo de receber é de 5 dias: passado dele, atrasado", () => {
    expect(PRAZO_DE_RECEBER_EM_DIAS).toBe(5);
    expect(pedidoAtrasado(5)).toBe(false);
    expect(pedidoAtrasado(6)).toBe(true);
  });
  it("os pedidos têm atrasados pendentes, em conferência com pendências abertas e no prazo", () => {
    const plano = planoDosPedidos();
    const pendentes = plano.filter((p) => p.situacao === "pendente");
    expect(pendentes.filter((p) => pedidoAtrasado(p.diasAbertos)).length).toBeGreaterThanOrEqual(2);
    expect(pendentes.filter((p) => !pedidoAtrasado(p.diasAbertos)).length).toBeGreaterThanOrEqual(
      1,
    );
    const conferencia = plano.filter((p) => p.situacao === "em_conferencia");
    expect(conferencia.length).toBeGreaterThanOrEqual(2);
    for (const p of conferencia) expect(p.pendencias.length).toBeGreaterThan(0);
    expect(conferencia.some((p) => pedidoAtrasado(p.diasAbertos))).toBe(true);
    expect(new Set(plano.map((p) => p.cavalo)).size).toBe(plano.length);
  });
  it("os pedidos novos ficam nos cavalos 11 a 20, longe dos cinco do Para receber (21 a 25)", () => {
    for (const p of planoDosPedidos()) {
      expect(p.cavalo).toBeGreaterThanOrEqual(11);
      expect(p.cavalo).toBeLessThanOrEqual(20);
    }
  });
  it("seis placas com troca de CR e de operação; duas com troca recente; CR e operação sempre diferentes", () => {
    const v = planoDosVinculos();
    expect(v).toHaveLength(6);
    expect(v.filter((x) => x.trocaHaDias <= TROCA_RECENTE_EM_DIAS)).toHaveLength(2);
    const crs = v.flatMap((x) => [x.crAntigo, x.crAtual]);
    expect(new Set(crs).size).toBe(12);
    for (const x of v) {
      expect(x.operacaoAntiga).not.toBe(x.operacaoAtual);
      expect(x.trocaHaDias).toBeGreaterThan(0);
      expect(x.trocaHaDias).toBeLessThan(x.inicioHaDias);
    }
  });
  it("os números dos cenários não colidem entre si nem com a frota base (1 a 50)", () => {
    const n = NUMEROS_DOS_CENARIOS;
    const daOperacao = Array.from(
      { length: n.operacaoDemo.placas },
      (_, i) => n.operacaoDemo.placaInicial + i,
    );
    const placas = [
      ...planoDosVinculos().map((x) => x.placa),
      n.placaComDoisCr.placa,
      n.placaComFrotaEAcionista.placa,
      n.placaDeCadastroIncompleto.placa,
      n.placaSemCr.placa,
      ...daOperacao,
    ];
    expect(new Set(placas).size).toBe(placas.length);
    const crs = [
      ...planoDosVinculos().flatMap((x) => [x.crAntigo, x.crAtual]),
      n.placaComDoisCr.crAtual,
      n.placaComDoisCr.crDuplicado,
      n.placaComFrotaEAcionista.crFrota,
      n.placaComFrotaEAcionista.crAcionista,
      n.placaDeCadastroIncompleto.cr,
      n.placaSemCr.cr,
      ...daOperacao,
      ...n.operacaoDemo.crsDeServico,
      n.crDeServicoSemOperacao,
      n.crQueDivergeDaUnidade,
    ];
    expect(new Set(crs).size).toBe(crs.length);
    for (const x of [...placas, ...crs]) expect(x).toBeGreaterThan(50);
    for (const x of crs) expect(x).toBeLessThanOrEqual(300);
  });
  it("o movimento recente tem anteontem, ontem e hoje, sem sigla repetida em dias seguidos e com variedade", () => {
    const todas = new Set<string>();
    for (let c = 11; c <= 25; c++) {
      const r = roteiroDoMovimento(c);
      expect(r.map((x) => x.diasAtras)).toEqual([2, 1, 0]);
      for (let k = 1; k < r.length; k++) expect(r[k]!.sigla).not.toBe(r[k - 1]!.sigla);
      for (const x of r) todas.add(x.sigla);
      expect(cavaloEmConjunto(c)).toBe(c <= 20);
    }
    expect(todas.size).toBeGreaterThanOrEqual(8);
    expect(() => roteiroDoMovimento(10)).toThrow();
    expect(() => roteiroDoMovimento(26)).toThrow();
  });
});
