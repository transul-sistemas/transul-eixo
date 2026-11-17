import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { todasAsTelas } from "@/lib/navegacao/catalogo";
import { PaginaDoMapa } from "./pagina-do-mapa";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

describe("<PaginaDoMapa>", () => {
  it("o Administrador vê todas as telas, com o estado e o perfil que vê", () => {
    const html = renderToStaticMarkup(<PaginaDoMapa perfil="Administrador" filtro="todos" />);
    expect(html).toContain("Mapa do sistema");
    expect(html.match(/data-tela=/g)).toHaveLength(todasAsTelas().length);
    // Fim da Fase 1: nenhuma tela de estrutura sobrou.
    expect(html).not.toContain('data-estado="esqueleto"');
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
