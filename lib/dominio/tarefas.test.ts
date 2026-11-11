import { describe, expect, it } from "vitest";
import {
  ASSUNTOS_DA_FILA,
  enderecoDaFila,
  montarTarefas,
  nomeDoAssunto,
  type NumerosDeTarefas,
} from "./tarefas";

const zerado: NumerosDeTarefas = {
  paraReceber: 0,
  pedidosAbertos: 0,
  excecoes: { total: 0, porAssunto: [] },
  placasComAlerta: 0,
  alertas: [],
};

describe("montarTarefas", () => {
  it("sem nada a fazer, não há tarefa", () => {
    expect(montarTarefas(zerado)).toEqual([]);
  });

  it("placas para receber vêm primeiro e levam ao filtro da lista", () => {
    const tarefas = montarTarefas({ ...zerado, paraReceber: 3, pedidosAbertos: 3 });
    expect(tarefas[0]).toMatchObject({
      id: "para-receber",
      quantidade: 3,
      texto: "3 placas para receber",
      href: "/frota/placas?chip=para_receber",
    });
  });

  it("usa o singular com uma só", () => {
    const [t] = montarTarefas({ ...zerado, paraReceber: 1 });
    expect(t?.texto).toBe("1 placa para receber");
  });

  it("pedidos abertos de outros gestores aparecem como panorama, sem contar os que são para mim", () => {
    const tarefas = montarTarefas({ ...zerado, paraReceber: 2, pedidosAbertos: 5 });
    expect(tarefas.map((t) => t.id)).toEqual(["para-receber", "pedidos-abertos"]);
    expect(tarefas[1]).toMatchObject({ quantidade: 3, texto: "3 pedidos de transferência abertos" });
  });

  it("se todos os pedidos abertos são para mim, não repete", () => {
    const tarefas = montarTarefas({ ...zerado, paraReceber: 2, pedidosAbertos: 2 });
    expect(tarefas.map((t) => t.id)).toEqual(["para-receber"]);
  });

  it("uma tarefa por assunto da fila, com o filtro na rota das exceções", () => {
    const tarefas = montarTarefas({
      ...zerado,
      excecoes: {
        total: 7,
        porAssunto: [
          { assunto: "cadastro_incompleto", n: 5 },
          { assunto: "pessoa_sem_documento", n: 2 },
        ],
      },
    });
    expect(tarefas.map((t) => t.texto)).toEqual([
      "5 placas com cadastro incompleto",
      "2 pessoas sem documento",
    ]);
    expect(tarefas[0]?.href).toBe("/frota/excecoes?assunto=cadastro_incompleto");
  });

  it("assunto desconhecido não quebra: usa o texto genérico", () => {
    const [t] = montarTarefas({
      ...zerado,
      excecoes: { total: 1, porAssunto: [{ assunto: "coisa_nova", n: 1 }] },
    });
    expect(t?.texto).toBe("1 exceção de outro tipo");
  });

  it("alertas das placas vêm por último e levam à lista de placas", () => {
    const tarefas = montarTarefas({
      ...zerado,
      paraReceber: 1,
      pedidosAbertos: 1,
      placasComAlerta: 4,
      alertas: [{ alerta: "sem_cr", n: 4 }],
    });
    expect(tarefas.at(-1)).toMatchObject({
      id: "alertas",
      quantidade: 4,
      texto: "4 placas com alerta",
      href: "/frota/placas",
    });
  });
});

describe("a fila de exceções", () => {
  it("dá nome a cada assunto conhecido e um genérico ao resto", () => {
    for (const assunto of ASSUNTOS_DA_FILA) {
      expect(nomeDoAssunto(assunto).trim()).not.toBe("");
    }
    expect(nomeDoAssunto("qualquer_outro")).toBe("Outro tipo");
  });

  it("o endereço da fila leva o assunto e a página só quando diferem do padrão", () => {
    expect(enderecoDaFila({ assunto: null, pagina: 1 })).toBe("/frota/excecoes");
    expect(enderecoDaFila({ assunto: "cadastro_incompleto", pagina: 1 })).toBe(
      "/frota/excecoes?assunto=cadastro_incompleto",
    );
    expect(enderecoDaFila({ assunto: null, pagina: 3 })).toBe("/frota/excecoes?pagina=3");
  });
});
