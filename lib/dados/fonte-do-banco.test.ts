import { describe, expect, it, vi } from "vitest";
import type { ConsultaDeTabela } from "@/lib/navegacao/tabela";
import { type ClienteDeLeitura, fonteDoBanco } from "./fonte-do-banco";

// A fonte do banco (fatia 3.9a): só converte. Quem filtra, ordena, pagina, conta e aplica a RLS é o
// banco (nucleo.listar_placas, contar_chips_de_placas, detalhe_da_placa, historia_da_placa).

const consulta = (parcial: Partial<ConsultaDeTabela> = {}): ConsultaDeTabela => ({
  busca: "",
  chips: [],
  siglas: [],
  baixadas: false,
  ordem: { campo: "placa", sentido: "asc" },
  pagina: 1,
  tam: 25,
  ...parcial,
});

const LINHA = {
  id: "a1",
  placa: "AAA1A11",
  tipo: "cavalo",
  modelo: "Scania R450",
  cavalo: null,
  implementos: ["AAA1A12"],
  gestor: "Gestor A",
  operacao: "Grãos",
  cr: "CR1",
  sigla: "DOp",
  nome_da_situacao: "Disponível ao Operacional",
  grupo: "em-atividade",
  desde: "2026-01-12T08:00",
  dias_no_status: 3,
  alertas: ["sem_cr", "parado_em_patio"],
  valor_fipe: 450000.5,
  filial: "Matriz",
  garagem: "Cordeirópolis",
  ano: 2022,
  renavam: "00000000801",
  baixada: false,
};

function cliente(respostas: Record<string, { data: unknown; error: { message: string } | null }>) {
  const rpc = vi.fn(async (funcao: string) => respostas[funcao] ?? { data: null, error: null });
  const c: ClienteDeLeitura = { schema: () => ({ rpc }) };
  return { c, rpc };
}

describe("consultar", () => {
  it("manda filtros, ordem e página ao banco, separando os chips de situação e de tipo", async () => {
    const { c, rpc } = cliente({
      listar_placas: {
        data: { linhas: [], total: 0, pagina: 1, paginas: 1, tam: 50 },
        error: null,
      },
      contar_chips_de_placas: { data: [], error: null },
    });
    await fonteDoBanco(async () => c).consultar(
      consulta({
        busca: "grãos",
        chips: ["patio", "cavalo", "em-atividade"],
        siglas: ["PÁT"],
        baixadas: true,
        ordem: { campo: "gestor", sentido: "desc" },
        pagina: 3,
        tam: 50,
      }),
      "2026-11-03",
      {},
    );
    expect(rpc).toHaveBeenCalledWith("listar_placas", {
      p_busca: "grãos",
      p_grupos: ["patio", "em-atividade"],
      p_tipos: ["cavalo"],
      p_siglas: ["PÁT"],
      p_baixadas: true,
      p_para_receber: false,
      p_ordem: "gestor",
      p_decrescente: true,
      p_pagina: 3,
      p_tam: 50,
    });
    expect(rpc).toHaveBeenCalledWith("contar_chips_de_placas", {
      p_busca: "grãos",
      p_grupos: ["patio", "em-atividade"],
      p_tipos: ["cavalo"],
      p_siglas: ["PÁT"],
      p_baixadas: true,
      p_para_receber: false,
    });
  });

  it("converte a linha do banco para a linha da tela (centavos, alertas com texto, vazio do banco)", async () => {
    const { c } = cliente({
      listar_placas: {
        data: { linhas: [LINHA], total: 1, pagina: 1, paginas: 1, tam: 25 },
        error: null,
      },
      contar_chips_de_placas: {
        data: [
          { chip: "em-atividade", quantidade: 1 },
          { chip: "cavalo", quantidade: 1 },
        ],
        error: null,
      },
    });
    const pagina = await fonteDoBanco(async () => c).consultar(consulta(), "2026-11-03", {});
    expect(pagina.total).toBe(1);
    expect(pagina.linhas[0]).toEqual({
      id: "a1",
      placa: "AAA1A11",
      tipo: "cavalo",
      modelo: "Scania R450",
      conjunto: { cavalo: null, implementos: ["AAA1A12"] },
      gestor: "Gestor A",
      operacao: "Grãos",
      cr: "CR1",
      sigla: "DOp",
      nomeDaSituacao: "Disponível ao Operacional",
      grupo: "em-atividade",
      diasNoStatus: 3,
      alertas: [
        { codigo: "sem_cr", texto: "Sem CR vigente" },
        { codigo: "parado_em_patio", texto: "Parada no pátio além do prazo" },
      ],
      km: null,
      valorFipeCentavos: 45000050,
      motorista: null,
      crlvVenceEm: null,
      filial: "Matriz",
      garagem: "Cordeirópolis",
    });
    expect(pagina.contagens).toMatchObject({
      "em-atividade": 1,
      cavalo: 1,
      patio: 0,
      implemento: 0,
    });
  });

  it("sem gestor ou sem filial no banco, a tela mostra o texto do vazio", async () => {
    const { c } = cliente({
      listar_placas: {
        data: {
          linhas: [{ ...LINHA, gestor: null, filial: null, alertas: [] }],
          total: 1,
          pagina: 1,
          paginas: 1,
          tam: 25,
        },
        error: null,
      },
      contar_chips_de_placas: { data: [], error: null },
    });
    const [linha] = (await fonteDoBanco(async () => c).consultar(consulta(), "2026-11-03", {}))
      .linhas;
    expect(linha?.gestor).toBe("Sem gestor");
    expect(linha?.filial).toBe("Sem filial");
  });

  it("erro do banco lança (a tela mostra o erro com Tentar de novo)", async () => {
    const { c } = cliente({
      listar_placas: { data: null, error: { message: "permission denied" } },
      contar_chips_de_placas: { data: [], error: null },
    });
    await expect(
      fonteDoBanco(async () => c).consultar(consulta(), "2026-11-03", {}),
    ).rejects.toThrow("permission denied");
  });

  it("sigla que a tela não conhece lança (nunca vira outra sigla)", async () => {
    const { c } = cliente({
      listar_placas: {
        data: {
          linhas: [{ ...LINHA, sigla: "pendente" }],
          total: 1,
          pagina: 1,
          paginas: 1,
          tam: 25,
        },
        error: null,
      },
      contar_chips_de_placas: { data: [], error: null },
    });
    await expect(
      fonteDoBanco(async () => c).consultar(consulta(), "2026-11-03", {}),
    ).rejects.toThrow(/pendente/);
  });
});

describe("alertas do banco", () => {
  it("alerta que a tela não conhece lança (nunca some calado)", async () => {
    const { c } = cliente({
      listar_placas: {
        data: {
          linhas: [{ ...LINHA, alertas: ["alerta_novo_do_banco"] }],
          total: 1,
          pagina: 1,
          paginas: 1,
          tam: 25,
        },
        error: null,
      },
      contar_chips_de_placas: { data: [], error: null },
    });
    await expect(
      fonteDoBanco(async () => c).consultar(consulta(), "2026-11-03", {}),
    ).rejects.toThrow(/alerta_novo_do_banco/);
  });
});

describe("obter e obterFicha", () => {
  const DETALHE = {
    ...LINHA,
    crs: [{ codigo: "CR1", nome: "CR1", inicio: "2026-01-10", fim: null }],
    crs_vigentes: [{ codigo: "CR1", nome: "CR1", inicio: "2026-01-10", fim: null }],
  };

  it("o detalhe traz ano, RENAVAM, desde e as vigências de CR", async () => {
    const { c, rpc } = cliente({ detalhe_da_placa: { data: DETALHE, error: null } });
    const detalhe = await fonteDoBanco(async () => c).obter("AAA1A11", "2026-11-03", {});
    expect(rpc).toHaveBeenCalledWith("detalhe_da_placa", { p_placa: "AAA1A11" });
    expect(detalhe).toMatchObject({
      placa: "AAA1A11",
      ano: 2022,
      renavam: "00000000801",
      desde: "2026-01-12T08:00",
      crs: [{ codigo: "CR1", nome: "CR1", inicio: "2026-01-10", fim: null }],
      crsVigentes: [{ codigo: "CR1", nome: "CR1", inicio: "2026-01-10", fim: null }],
      // KM, motorista e CRLV ainda sem fonte: a tela mostra "Sem dados ainda".
      semFonte: ["km", "motorista", "crlv"],
    });
  });

  it("placa que não existe ou não se vê: nulo (a tela mostra 'não encontrada')", async () => {
    const { c } = cliente({ detalhe_da_placa: { data: null, error: null } });
    expect(await fonteDoBanco(async () => c).obter("BBB2B22", "2026-11-03", {})).toBeNull();
    expect(await fonteDoBanco(async () => c).obterFicha("BBB2B22", "2026-11-03", {})).toBeNull();
  });

  it("a ficha junta o detalhe e a história de situações", async () => {
    const { c } = cliente({
      detalhe_da_placa: { data: DETALHE, error: null },
      historia_da_placa: {
        data: [
          { sigla: "PÁT", em: "2026-01-10T08:00" },
          { sigla: "DOp", em: "2026-01-12T08:00" },
        ],
        error: null,
      },
    });
    const ficha = await fonteDoBanco(async () => c).obterFicha("AAA1A11", "2026-11-03", {});
    expect(ficha?.eventos).toEqual([
      { sigla: "PÁT", em: "2026-01-10T08:00" },
      { sigla: "DOp", em: "2026-01-12T08:00" },
    ]);
  });
});

// Plano B do recálculo agendado (3.9a): sem agendador, as linhas vencidas (vigência futura que chegou)
// são recalculadas antes de ler a lista e o detalhe.
describe("as linhas vencidas antes da leitura", () => {
  it("a lista e o detalhe chamam atualizar_leitura_vencida antes de ler", async () => {
    const { c, rpc } = cliente({
      listar_placas: {
        data: { linhas: [], total: 0, pagina: 1, paginas: 1, tam: 25 },
        error: null,
      },
      contar_chips_de_placas: { data: [], error: null },
    });
    const fonte = fonteDoBanco(async () => c);
    await fonte.consultar(consulta(), "2026-11-03", {});
    const chamadas = rpc.mock.calls.map((chamada) => chamada[0]);
    expect(chamadas[0]).toBe("atualizar_leitura_vencida");
    expect(chamadas.slice(1).sort()).toEqual(["contar_chips_de_placas", "listar_placas"]);
    rpc.mockClear();
    await fonte.obter("AAA1A11", "2026-11-03", {});
    expect(rpc.mock.calls.map((chamada) => chamada[0])).toEqual([
      "atualizar_leitura_vencida",
      "detalhe_da_placa",
    ]);
  });
  it("se a atualização falhar, a leitura segue (a linha vencida volta na próxima)", async () => {
    const { c } = cliente({
      atualizar_leitura_vencida: { data: null, error: { message: "ocupado" } },
      detalhe_da_placa: { data: null, error: null },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await fonteDoBanco(async () => c).obter("AAA1A11", "2026-11-03", {})).toBeNull();
  });
});
