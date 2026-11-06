// Gera um CSV FICTÍCIO no formato da "Auditoria de Centros de Resultado" do Sankhya (fatia 3.9c), para
// os testes do importador. Nenhum dado real: códigos sequenciais, nomes "CR FICTÍCIO n" e acionistas
// "Acionista FICTÍCIO n". O arquivo real fica em importacao/ (fora do Git) e nunca entra em teste.

export const CABECALHO_DO_CSV_DE_CR = [
  "Status de Uso",
  "Bloqueado",
  "Cód. Centro de Resultado",
  "Centro de Resultado",
  "Gerencial",
  "Operação",
  "Filial",
  "Cód. Centro de Resultado Pai",
  "Centro de Resultado Pai",
  "Frota",
] as const;

export interface LinhaFicticia {
  codigo: number;
  nome?: string;
  bloqueado?: "Sim" | "Não";
  gerencial?: string;
  operacao?: string;
  filial?: string;
  codigoPai?: number | null;
  nomePai?: string;
  frota?: "Sim" | "Não";
}

function campo(texto: string): string {
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** O CSV com as duas linhas de título do relatório, o cabeçalho e as linhas (BOM e CRLF, como o Sankhya). */
export function csvDeCrFicticio(linhas: readonly LinhaFicticia[]): string {
  const vazia = ";".repeat(CABECALHO_DO_CSV_DE_CR.length - 1);
  const corpo = linhas.map((l) =>
    [
      "Disponível",
      l.bloqueado ?? "Não",
      String(l.codigo),
      l.nome ?? `CR FICTÍCIO ${l.codigo}`,
      l.gerencial ?? "TranSul Frota",
      l.operacao ?? "Operação Matriz (São Luís/MA)",
      l.filial ?? "Matriz",
      l.codigoPai === null ? "" : String(l.codigoPai ?? 2000000),
      l.codigoPai === null ? "" : (l.nomePai ?? "FROTA FICTÍCIA"),
      l.frota ?? "Sim",
    ]
      .map(campo)
      .join(";"),
  );
  return (
    "﻿" +
    [
      `Auditoria de Centros de Resultado (Analíticos)${vazia.slice(1)}`,
      vazia,
      CABECALHO_DO_CSV_DE_CR.join(";"),
      ...corpo,
      vazia,
    ].join("\r\n")
  );
}

/** Um conjunto variado: frota nas 3 filiais, serviço, acionista, participações, TransuLOG, sem unidade,
 * operação desconhecida, bloqueado e divergência de AD_FROTA. */
export function conjuntoFicticio(): LinhaFicticia[] {
  return [
    { codigo: 2100001 },
    {
      codigo: 4100001,
      filial: "Cordeirópolis/SP",
      operacao: "Operação Sudeste (Cordeirópolis/SP)",
      codigoPai: 4000000,
    },
    {
      codigo: 6100001,
      filial: "Parauapebas/PA",
      operacao: "Operação Norte (Parauapebas/PA)",
      codigoPai: 6000000,
    },
    { codigo: 2100002, bloqueado: "Sim", operacao: "Sem Operação Matriz (São Luís/MA)" },
    {
      codigo: 2200001,
      gerencial: "TranSul Serviço",
      operacao: "Administrativo (São Luís/MA)",
      frota: "Não",
    },
    {
      codigo: 21000001,
      gerencial: "TranSul Acionista",
      operacao: "Acionista FICTÍCIO 1",
      frota: "Não",
      codigoPai: 21000000,
      nomePai: "ACIONISTA FICTÍCIO",
    },
    {
      codigo: 2300001,
      gerencial: "TranSul Participações",
      operacao: "Operação TranSul Participações",
      frota: "Não",
    },
    { codigo: 2300002, gerencial: "TransuLOG", operacao: "Operação TransuLOG", frota: "Não" },
    { codigo: 2400001, gerencial: "", operacao: "", filial: "", frota: "Não", codigoPai: null },
    { codigo: 2100003, operacao: "Operação Inexistente (Lugar/XX)" },
    {
      codigo: 2200002,
      gerencial: "TranSul Serviço",
      operacao: "Operação Matriz (São Luís/MA)",
      frota: "Sim",
    },
  ];
}
