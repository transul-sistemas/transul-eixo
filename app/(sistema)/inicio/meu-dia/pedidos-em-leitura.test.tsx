import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LinhaDoPedido } from "@/lib/dominio/meu-dia";
import { ColunaDoEnvio } from "./colunas-do-lote";
import { FRASE_DO_MODO_LEITURA, PedidosEmLeitura } from "./pedidos-em-leitura";

// O BotaoDoOlho abre painel no navegador; aqui só importa a marcação da leitura.
vi.mock("@/components/tabela/botao-do-olho", () => ({ BotaoDoOlho: () => <span data-olho /> }));

const HOJE = "2026-11-12";

function linha(extra: Partial<LinhaDoPedido> = {}): LinhaDoPedido {
  return {
    pedido: {
      id: "1",
      placa: "ZDM1A02",
      deGestorId: "g1",
      deGestor: "Gestor Demo 03",
      paraGestorId: "g2",
      paraGestor: "Gestor Demo 01",
      motivo: "troca",
      pendenciasConhecidas: [],
      situacao: "pendente",
      versao: 1,
    },
    crs: [{ codigo: "CR011", nome: "Atual" }],
    operacao: "Operação A",
    enviadaEm: "2026-11-04T15:30:00Z",
    prazoDias: 5,
    ...extra,
  };
}

describe("o Administrador vê a fila em modo leitura", () => {
  const html = renderToStaticMarkup(<PedidosEmLeitura linhas={[linha()]} hoje={HOJE} />);

  it("diz, em uma frase, que só o gestor de destino decide", () => {
    expect(html).toContain(FRASE_DO_MODO_LEITURA);
  });

  it("não tem os botões de decidir nem campo de motivo", () => {
    expect(html).not.toMatch(/Aceitar|Com pendências|Recusar|radio|<input|<button/);
  });

  it("mostra os dados: placa, quem enviou, destino e CR vigente", () => {
    expect(html).toContain("Gestor Demo 03");
    expect(html).toContain("Gestor Demo 01");
    expect(html).toContain("CR011");
  });
});

describe("ColunaDoEnvio: há N dias e o prazo vencido", () => {
  it("vencido: vermelho suave com ícone e texto (não só a cor)", () => {
    const html = renderToStaticMarkup(<ColunaDoEnvio linha={linha()} hoje={HOJE} />);
    expect(html).toContain("há 8 dias");
    expect(html).toContain("prazo vencido");
    expect(html).toContain('data-tom="status:impedida"');
    expect(html).toContain("<svg");
  });

  it("dentro do prazo: só o texto, sem tom de alerta", () => {
    const html = renderToStaticMarkup(
      <ColunaDoEnvio linha={linha({ enviadaEm: "2026-11-10T15:00:00Z" })} hoje={HOJE} />,
    );
    expect(html).toContain("há 2 dias");
    expect(html).not.toContain("vencido");
    expect(html).not.toContain("data-tom");
  });

  it("sem data de envio, só mostra quem enviou", () => {
    const html = renderToStaticMarkup(
      <ColunaDoEnvio linha={linha({ enviadaEm: null })} hoje={HOJE} />,
    );
    expect(html).toContain("Gestor Demo 03");
    expect(html).not.toContain("há ");
  });
});
