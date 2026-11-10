// Verificações do teste de consistência do "esqueleto global" (10/11/2026; docs/esqueleto-global.md).
// O critério (i), 20 por página, é o de `lista-de-vinte.ts`. Aqui ficam os demais: toda tela do
// catálogo tem página, toda tela esqueleto só abre para Administrador e Diretoria, toda estrutura de
// esqueleto fecha a grade de 12 colunas e toda tabela de dados tem o olho.
import { existsSync } from "node:fs";
import { linhasFecham } from "@/components/layout/grade-de-paineis";
import { todasAsTelas } from "@/lib/navegacao/catalogo";
import { ESQUELETOS } from "@/lib/navegacao/esqueletos";
import { PERFIS } from "@/lib/navegacao/perfis";
import { podeAbrir } from "@/lib/navegacao/visibilidade";
import { lerTexto, listarArquivos } from "./armadilhas";

/** As telas do catálogo cuja página (`page.tsx`) não existe. */
export function telasSemPagina(raiz = "app/(sistema)"): string[] {
  return todasAsTelas()
    .filter((t) => !existsSync(`${raiz}${t.rota}/page.tsx`))
    .map((t) => t.id);
}

/** As telas esqueleto que algum perfil fora de Administrador e Diretoria consegue abrir. */
export function esqueletosAbertosDemais(): string[] {
  return todasAsTelas()
    .filter((t) => t.estado === "esqueleto")
    .filter((t) =>
      PERFIS.some((p) => p !== "Administrador" && p !== "Diretoria" && podeAbrir(p, t)),
    )
    .map((t) => t.id);
}

/** As telas esqueleto sem estrutura registrada, e as estruturas sem tela esqueleto. */
export function esqueletosSemEstruturaOuSobrando(): string[] {
  const esqueletos = todasAsTelas()
    .filter((t) => t.estado === "esqueleto")
    .map((t) => t.id);
  const semEstrutura = esqueletos.filter((id) => !(id in ESQUELETOS));
  const sobrando = Object.keys(ESQUELETOS).filter((id) => !esqueletos.includes(id));
  return [
    ...semEstrutura.map((id) => `sem estrutura: ${id}`),
    ...sobrando.map((id) => `sobra: ${id}`),
  ];
}

/** As estruturas fora do padrão: menos de 3 KPIs, tabela sem colunas, ou linha de painéis que não soma 12. */
export function estruturasForaDoPadrao(): string[] {
  const erros: string[] = [];
  for (const [id, e] of Object.entries(ESQUELETOS)) {
    if (e.kpis.length < 3) erros.push(`${id}: menos de 3 KPIs`);
    if (e.tabela.colunas.length < 3) erros.push(`${id}: tabela com menos de 3 colunas`);
    if (e.apoio.length < 2 || e.apoio.length > 3)
      erros.push(`${id}: painéis de apoio fora de 2 a 3`);
    if (!linhasFecham(e.apoio.map((p) => p.colunas)))
      erros.push(`${id}: a linha de apoio não soma 12`);
    if (!e.fonte.trim()) erros.push(`${id}: sem fonte`);
  }
  return erros.sort();
}

/** O que mostra uma tabela de dados, no componente padrão ou em tabela própria. */
const TABELA = /<(TabelaDeDados|TabelaDePlacas|table)\b/;
const OLHO = /BotaoDoOlho|IconEye/;

/** Os arquivos de tela (e a tela esqueleto) com tabela de dados, mas sem o olho. */
export function tabelasSemOlho(): string[] {
  const arquivos = [
    ...listarArquivos("app/(sistema)", /\.tsx$/),
    ...listarArquivos("components", /\.tsx$/),
  ].filter((a) => !/\.test\.tsx$/.test(a));
  return arquivos
    .filter((a) => {
      const texto = lerTexto(a);
      return TABELA.test(texto) && !OLHO.test(texto);
    })
    .sort();
}
