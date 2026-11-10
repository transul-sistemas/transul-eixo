import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { todasAsTelas } from "@/lib/navegacao/catalogo";
import { ESQUELETOS } from "@/lib/navegacao/esqueletos";
import { PaginaDoMapa } from "@/app/(sistema)/inicio/mapa-do-sistema/pagina-do-mapa";
import { TelaDeEsqueleto, textoSemDados } from "./tela-de-esqueleto";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const esqueletos = todasAsTelas().filter((t) => t.estado === "esqueleto");

describe("<TelaDeEsqueleto>", () => {
  it.each(esqueletos.map((t) => [t.rota, t.nome] as const))(
    "%s abre inteira, no padrão, sem inventar número",
    (rota, nome) => {
      const html = renderToStaticMarkup(<TelaDeEsqueleto rota={rota} />);
      const e = ESQUELETOS[esqueletos.find((t) => t.rota === rota)?.id ?? ""];
      expect(e).toBeDefined();
      if (!e) return;
      expect(html).toContain("<h1");
      expect(html).toContain(nome);
      // KPIs, visão principal e painéis dizem do que dependem; nenhum valor aparece.
      expect(html).toContain(textoSemDados(e.fonte));
      expect(html).toContain('aria-label="Indicadores"');
      for (const kpi of e.kpis) expect(html).toContain(kpi.rotulo);
      expect(html).toContain(e.principal.titulo);
      for (const painel of e.apoio) expect(html).toContain(painel.titulo);
      // A tabela e o olho como último botão da linha.
      for (const coluna of e.tabela.colunas) expect(html).toContain(coluna);
      expect(html).toContain(`Ver detalhes de ${e.tabela.item}`);
      expect(html).not.toContain("R$");
      expect(html).not.toContain("NaN");
    },
  );

  it("o olho é o último botão da tabela", () => {
    const html = renderToStaticMarkup(<TelaDeEsqueleto rota="/resultados/ajustes" />);
    const ultimaCelula = html.slice(html.lastIndexOf("<td"));
    expect(ultimaCelula).toContain("data-olho=");
  });

  it("rota fora do catálogo vira página não encontrada", () => {
    expect(() => renderToStaticMarkup(<TelaDeEsqueleto rota="/nada" />)).toThrow("NEXT_NOT_FOUND");
  });
});

describe("<PaginaDoMapa>", () => {
  it("o Administrador vê as 35 telas, com o estado e o perfil que vê", () => {
    const html = renderToStaticMarkup(<PaginaDoMapa perfil="Administrador" filtro="todos" />);
    expect(html).toContain("Mapa do sistema");
    expect(html.match(/data-tela=/g)).toHaveLength(todasAsTelas().length);
    expect(html).toContain("Estrutura");
    expect(html).toContain("Quem vê: Administrador, Diretoria");
    expect(html).toContain('href="/inicio/tarefas"');
  });

  it("o Operacional não vê nenhuma tela de estrutura nem a Frota", () => {
    const html = renderToStaticMarkup(<PaginaDoMapa perfil="Operacional" filtro="todos" />);
    expect(html).not.toContain('data-estado="esqueleto"');
    expect(html).not.toContain('href="/frota/placas"');
    expect(html).toContain('href="/operacional/patio"');
  });
});
