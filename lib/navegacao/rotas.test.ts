import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FUNCOES_DOS_PAINEIS } from "@/lib/dados/paineis";
import { CATALOGO, todasAsTelas } from "./catalogo";

// A regra "rota ⇔ catálogo": toda rota do catálogo tem página, e nenhuma página existe fora dele.

function paginasDe(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return paginasDe(caminho);
    return nome === "page.tsx" ? [caminho.replaceAll("\\", "/")] : [];
  });
}

/** `app/(sistema)/frota/placas/page.tsx` → `/frota/placas`; `app/page.tsx` → `/`. */
function rotaDe(arquivo: string): string {
  const caminho = arquivo
    .replace(/^app\//, "")
    .replace(/\/?page\.tsx$/, "")
    .split("/")
    .filter((trecho) => !/^\(.+\)$/.test(trecho))
    .join("/");
  return `/${caminho}`;
}

const paginas = paginasDe("app");
const rotasDasPaginas = paginas.map(rotaDe);
const telas = todasAsTelas();
const rotasDeModulo = CATALOGO.map((m) => m.rota);
// As telas de acesso (fatia 3.8) ficam fora do catálogo e fora da casca do sistema, em app/(acesso)/.
const ROTAS_DE_ACESSO = ["/entrar", "/esqueci-a-senha", "/nova-senha", "/acesso-nao-liberado"];
// Rotas filhas de uma tela do catálogo que não são item de menu nem ficha: a legenda do Acompanhamento
// (A5) abre pelo botão "Legenda" da grade e herda a permissão de Frota.
const ROTAS_FILHAS = ["/frota/acompanhamento/legenda"];

describe("rotas e catálogo", () => {
  it.each(telas.map((t) => [t.rota, t.id] as const))("a rota %s (%s) tem página", (rota) => {
    expect(rotasDasPaginas).toContain(rota);
  });
  it("nenhuma página existe fora do catálogo, exceto a raiz, a de cada módulo e a ficha de uma tela com ficha", () => {
    // A ficha é a rota filha `<tela>/[identificador]` de uma tela marcada com `ficha` no catálogo.
    const ehFicha = (rota: string) =>
      telas.some((t) => t.ficha && new RegExp(`^${t.rota}/\\[[a-z]+\\]$`).test(rota));
    const foraDoCatalogo = rotasDasPaginas.filter(
      (rota) =>
        rota !== "/" &&
        !ROTAS_DE_ACESSO.includes(rota) &&
        !ROTAS_FILHAS.includes(rota) &&
        !rotasDeModulo.includes(rota) &&
        !telas.some((t) => t.rota === rota) &&
        !ehFicha(rota),
    );
    expect(foraDoCatalogo).toEqual([]);
  });
  it.each(ROTAS_FILHAS)("a rota filha %s existe e fica sob uma tela do catálogo", (rota) => {
    expect(rotasDasPaginas).toContain(rota);
    expect(telas.some((t) => rota.startsWith(`${t.rota}/`))).toBe(true);
  });
  it("a ficha da placa existe como rota filha de Placas", () => {
    expect(rotasDasPaginas).toContain("/frota/placas/[placa]");
  });
  it.each(CATALOGO.map((m) => [m.rota, m.id] as const))(
    "o módulo %s tem página, que redireciona para a sua primeira tela visível",
    (rota, id) => {
      expect(rotasDasPaginas).toContain(rota);
      const codigo = readFileSync(`app/(sistema)${rota}/page.tsx`, "utf-8");
      expect(codigo).toContain(`<IrParaOModulo modulo="${id}"`);
    },
  );
  it("não há duas páginas para a mesma rota", () => {
    expect(new Set(rotasDasPaginas).size).toBe(rotasDasPaginas.length);
  });
  it("as páginas do sistema ficam em app/(sistema)/; as de acesso, só em app/(acesso)/", () => {
    const fora = paginas.filter(
      (p) =>
        p !== "app/page.tsx" && !p.startsWith("app/(sistema)/") && !p.startsWith("app/(acesso)/"),
    );
    expect(fora).toEqual([]);
    const deAcesso = paginas.filter((p) => p.startsWith("app/(acesso)/")).map(rotaDe);
    expect([...deAcesso].sort()).toEqual([...ROTAS_DE_ACESSO].sort());
  });
  it("não sobrou pasta de módulo solta em app/", () => {
    const modulos = ["inicio", "frota", "operacional", "operacoes", "pessoas", "parceiros"];
    const restantes = [...modulos, "resultados", "cadastros", "admin"].filter((m) =>
      existsSync(join("app", m)),
    );
    expect(restantes).toEqual([]);
  });
});

describe("páginas das telas de painel", () => {
  it("nenhuma tela é esqueleto ao fim da Fase 1", () => {
    expect(telas.filter((t) => t.estado === "esqueleto").map((t) => t.id)).toEqual([]);
  });
  it.each(
    Object.keys(FUNCOES_DOS_PAINEIS).filter(
      (id) => id.split(".")[1] !== "abastecimento-provisorio",
    ),
  )("%s usa TelaDePainel com o mesmo id e a rota do catálogo", (id) => {
    const tela = telas.find((t) => t.id === id);
    expect(tela, id).toBeDefined();
    const codigo = readFileSync(`app/(sistema)${tela?.rota}/page.tsx`, "utf-8");
    expect(codigo).toContain(`const ROTA = "${tela?.rota}";`);
    expect(codigo).toContain(`id="${id}"`);
    expect(codigo).toContain("<TelaDePainel");
  });
});

describe("a raiz", () => {
  it("redireciona para a primeira tela do perfil da sessão (aprovação da 3.8)", () => {
    const codigo = readFileSync("app/page.tsx", "utf-8");
    expect(codigo).toContain("redirect(destinoInicial(perfil))");
    expect(codigo).not.toContain('redirect("/inicio/tarefas")');
  });
});
