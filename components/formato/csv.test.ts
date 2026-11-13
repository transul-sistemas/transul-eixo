import { describe, expect, it } from "vitest";
import { montarCsv } from "./csv";

// O CSV que o servidor entrega (exportar a fila de exceções): ponto e vírgula (Excel em português), BOM
// para o acento abrir certo, aspas só quando o campo precisa, e linhas com \r\n.

describe("montarCsv", () => {
  it("começa com o BOM e separa por ponto e vírgula", () => {
    const csv = montarCsv(["Placa", "Tipo"], [["AAA1A11", "Cadastro"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe("Placa;Tipo\r\nAAA1A11;Cadastro\r\n");
  });

  it("põe aspas em campo com ponto e vírgula, aspas ou quebra de linha, dobrando as aspas", () => {
    const csv = montarCsv(["A"], [['tem; "aspas"'], ["duas\nlinhas"]]);
    expect(csv.slice(1)).toBe('A\r\n"tem; ""aspas"""\r\n"duas\nlinhas"\r\n');
  });

  it("campo nulo vira vazio", () => {
    expect(montarCsv(["A", "B"], [[null, "x"]]).slice(1)).toBe("A;B\r\n;x\r\n");
  });

  it("neutraliza fórmula (=, +, -, @) para a planilha não executar", () => {
    expect(montarCsv(["A"], [["=SOMA(1)"]]).slice(1)).toBe("A\r\n'=SOMA(1)\r\n");
  });
});
