import { describe, expect, it } from "vitest";
import type { Catalogos, ItemCriado } from "./escrita-tipos";
import { mesclarCatalogos } from "./catalogos-locais";

const vazio: Catalogos = {
  marcas: [{ id: "marca-volvo", nome: "Volvo" }],
  modelos: [{ id: "modelo-fh", nome: "FH 540", marcaId: "marca-volvo" }],
  carrocerias: [{ id: "carroceria-sider", nome: "Sider" }],
  gestores: [{ id: "gestor-1", nome: "Gestor 1" }],
  operacoes: [{ id: "op-1", nome: "Operação 1" }],
  crs: [{ id: "cr-1001", codigo: "CR-1001", operacaoId: "op-1" }],
  filiais: [{ id: "filial-a", nome: "Filial A" }],
};

describe("mesclarCatalogos: o que o + criou entra no catálogo da tela", () => {
  it("sem itens criados devolve o catálogo como está", () => {
    expect(mesclarCatalogos(vazio, [])).toEqual(vazio);
  });

  it("cada tipo entra na lista certa, com o pai no campo certo", () => {
    const criados: ItemCriado[] = [
      { tipo: "marca", id: "marca-daf", nome: "DAF" },
      { tipo: "modelo", id: "modelo-xf", nome: "XF 530", paiId: "marca-daf" },
      { tipo: "gestor", id: "gestor-novo", nome: "Gestor Novo" },
      { tipo: "operacao", id: "op-nova", nome: "Operação Nova" },
      { tipo: "cr", id: "cr-2001", nome: "CR-2001", paiId: "op-nova" },
      { tipo: "filial", id: "filial-nova", nome: "Filial Nova" },
    ];
    const c = mesclarCatalogos(vazio, criados);
    expect(c.marcas.at(-1)).toEqual({ id: "marca-daf", nome: "DAF" });
    expect(c.modelos.at(-1)).toEqual({ id: "modelo-xf", nome: "XF 530", marcaId: "marca-daf" });
    expect(c.gestores.at(-1)).toEqual({ id: "gestor-novo", nome: "Gestor Novo" });
    expect(c.operacoes.at(-1)).toEqual({ id: "op-nova", nome: "Operação Nova" });
    expect(c.crs.at(-1)).toEqual({ id: "cr-2001", codigo: "CR-2001", operacaoId: "op-nova" });
    expect(c.filiais.at(-1)).toEqual({ id: "filial-nova", nome: "Filial Nova" });
  });

  it("CR sem operação entra sem operação (serve a qualquer uma)", () => {
    const c = mesclarCatalogos(vazio, [{ tipo: "cr", id: "c", nome: "CR-9999" }]);
    expect(c.crs.at(-1)).toEqual({ id: "c", codigo: "CR-9999", operacaoId: null });
  });

  it("o item que o servidor já devolveu no catálogo não entra duas vezes", () => {
    const c = mesclarCatalogos(vazio, [{ tipo: "marca", id: "marca-volvo", nome: "Volvo" }]);
    expect(c.marcas).toHaveLength(1);
  });

  it("não muda o catálogo de entrada", () => {
    const copia = structuredClone(vazio);
    mesclarCatalogos(vazio, [{ tipo: "marca", id: "marca-daf", nome: "DAF" }]);
    expect(vazio).toEqual(copia);
  });

  it("modelo sem marca é ignorado (nunca entra órfão)", () => {
    const c = mesclarCatalogos(vazio, [{ tipo: "modelo", id: "m", nome: "Sem pai" }]);
    expect(c.modelos).toHaveLength(1);
  });
});
