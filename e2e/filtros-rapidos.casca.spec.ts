import { test } from "@playwright/test";
import { testesDosFiltrosRapidos } from "./apoio-filtros-rapidos";

test.describe("filtros rápidos da lista de placas (tablet e celular)", () => {
  testesDosFiltrosRapidos();
});
