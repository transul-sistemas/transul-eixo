import { expect, type Locator, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

export const LISTA = "/frota/placas";
export const FICHA = (placa: string, consulta = "") => `${LISTA}/${placa}${consulta}`;

/** Um armazém de exemplo só deste teste: o cookie da sessão separa o que cada teste grava. */
export async function sessaoIsolada(
  context: import("@playwright/test").BrowserContext,
  baseURL: string | undefined,
) {
  const id = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await context.addCookies([
    { name: "eixo-sessao-exemplo", value: id, url: baseURL ?? "http://localhost:3000" },
  ]);
  return id;
}

/** Uma placa Mercosul que ninguém usa (ZZ + letra + número + letra + dois números). */
export function placaUnica(): string {
  const letra = () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)];
  const numero = () => String(Math.floor(Math.random() * 10));
  return `ZZ${letra()}${numero()}${letra()}${numero()}${numero()}`;
}

export const dialogo = (page: Page, nome: string) =>
  page.getByRole("dialog", { name: nome, exact: true });
export const cadastro = (page: Page) => dialogo(page, "Cadastrar placa");
export const recebimento = (page: Page) => dialogo(page, "Receber placa");
export const disponibilizacao = (page: Page) => dialogo(page, "Disponibilizar ao Operacional");
export const passoAtual = (caixa: Locator) =>
  caixa
    .getByRole("navigation", { name: "Passos do assistente" })
    .locator('li[aria-current="step"]');

export async function abrirLista(page: Page, consulta = "") {
  await abrirHidratada(page, `${LISTA}${consulta}`);
}

/** Abre o cadastro pelo botão do topo da lista. */
export async function abrirOCadastro(page: Page) {
  await abrirLista(page);
  await page.getByRole("button", { name: "Cadastrar placa", exact: true }).click();
  await expect(cadastro(page)).toBeVisible();
}

const avancar = (caixa: Locator) => caixa.getByRole("button", { name: "Continuar" }).click();

export interface DadosDoCadastro {
  placa: string;
  tipo?: "Cavalo" | "Implemento" | "Equipamento" | "Caminhão" | "Apoio";
  marca?: string;
  modelo?: string;
  ano?: string;
  operacao?: string;
  cr?: string;
}

/** Passo 1: placa, RENAVAM, tipo e ano; avança. */
export async function passoIdentificacao(page: Page, d: DadosDoCadastro) {
  const c = cadastro(page);
  await c.getByLabel("Placa", { exact: true }).fill(d.placa);
  await c.getByLabel("RENAVAM").fill("00639884962");
  await c.getByLabel("Tipo de ativo").selectOption({ label: d.tipo ?? "Cavalo" });
  await c.getByLabel("Ano").fill(d.ano ?? "2022");
  await avancar(c);
}

/** Passo 2: marca e modelo; avança. */
export async function passoVeiculo(page: Page, d: Partial<DadosDoCadastro>) {
  const c = cadastro(page);
  await c.getByLabel("Marca", { exact: true }).selectOption({ label: d.marca ?? "Volvo" });
  await c.getByLabel("Modelo", { exact: true }).selectOption({ label: d.modelo ?? "FH 540" });
  await avancar(c);
}

/** Passo 3: valor (FIPE para cavalo e caminhão; manual, fonte e data para os demais); avança. */
export async function passoValor(page: Page, tipo = "Cavalo") {
  const c = cadastro(page);
  if (tipo === "Cavalo" || tipo === "Caminhão") {
    await c.getByLabel("Código FIPE").fill("509035-0");
    await c.getByLabel("Valor FIPE").click();
    await page.keyboard.type("7850000");
  } else {
    await c.getByLabel("Valor", { exact: true }).click();
    await page.keyboard.type("2500000");
    await c.getByLabel("Fonte do valor").fill("Nota fiscal de compra");
    await c.getByLabel("Data do valor").fill("2026-09-10");
  }
  await avancar(c);
}

/** Passo 4: gestor, operação e CR; avança. */
export async function passoPosse(page: Page, d: Partial<DadosDoCadastro>) {
  const c = cadastro(page);
  await c.getByLabel("Gestor de frota").selectOption({ label: "Gestor Exemplo 1" });
  if (d.operacao) {
    await c.getByLabel("Operação", { exact: true }).selectOption({ label: d.operacao });
    await c.getByLabel("CR", { exact: true }).selectOption({ label: d.cr ?? "CR-1001" });
  }
  await avancar(c);
}

/** Passo 5: filial, garagem e situação inicial; avança para conferir. */
export async function passoLocal(page: Page) {
  const c = cadastro(page);
  await c.getByLabel("Filial", { exact: true }).selectOption({ label: "Filial Exemplo A" });
  await c.getByLabel("Garagem", { exact: true }).selectOption({ label: "Garagem A1" });
  await avancar(c);
}

/** Do começo até o passo de conferir, com dados válidos. */
export async function irAteConferirOCadastro(page: Page, d: DadosDoCadastro) {
  await passoIdentificacao(page, d);
  await passoVeiculo(page, d);
  await passoValor(page, d.tipo);
  await passoPosse(page, d);
  await passoLocal(page);
  await expect(cadastro(page).getByRole("button", { name: "Cadastrar placa" })).toBeVisible();
}

/** Procura a placa na lista pela busca (a URL guarda o termo). */
export async function buscarNaLista(page: Page, placa: string) {
  await page.getByRole("searchbox", { name: "Buscar placa" }).fill(placa);
  await expect(page).toHaveURL(new RegExp(`q=${placa}`));
  return page.locator(`[data-espiar-placa="${placa}"]`);
}
