// Exportar CSV (Fase 1, N3): toda lista do catálogo tem o botão "Exportar CSV" na barra de consulta. O
// arquivo é gerado no servidor (`/exportar/<id da tela>`), com a sessão de quem pede (a RLS decide o que
// entra), os mesmos filtros da tela e a lista inteira, não só a página. Aqui fica só o que é puro: quem é
// lista e o endereço do CSV. O teste `exportacao.test.ts` confere que toda tela do catálogo está em uma das
// duas listas abaixo e que toda lista tem o botão e o exportador.

/** As telas de painel (TelaDePainel): o exportador é um só, pela tabela da leitura. */
export const LISTAS_DE_PAINEL = [
  "inicio.resumo-do-dia",
  "operacional.analise",
  "operacoes.comparativo",
  "operacoes.analise",
  "pessoas.status-diario",
  "pessoas.documentos",
  "pessoas.diarias-e-premiacao",
  "pessoas.campanhas",
  "pessoas.analise",
  "parceiros.livro-do-acionista",
  "resultados.por-operacao",
  "resultados.maturacao",
  "resultados.fechamentos",
  "resultados.ajustes",
  "admin.auditoria",
] as const;

/** As listas com tabela própria: cada uma tem o seu exportador (lib/exportacao/exportadores.ts). */
export const LISTAS_PROPRIAS = [
  "inicio.tarefas",
  "frota.placas",
  "frota.abastecimento",
  "frota.carteira",
  "frota.excecoes",
  "operacional.patio",
  "operacional.ordens-de-carregamento",
  "operacoes.lista",
  "pessoas.lista",
  "parceiros.lista",
  "parceiros.conciliacao",
  "parceiros.locacao",
  "cadastros.catalogos",
  "cadastros.saude-do-cr",
  "admin.usuarios-e-perfis",
] as const;

export type IdDaListaDePainel = (typeof LISTAS_DE_PAINEL)[number];
export type IdDaListaPropria = (typeof LISTAS_PROPRIAS)[number];
export type IdDaLista = IdDaListaDePainel | IdDaListaPropria;

/** As telas que não são lista de itens, com o motivo (não ganham o botão). */
export const TELAS_SEM_LISTA: Record<string, string> = {
  "inicio.meu-dia": "fila guiada do dia, não lista",
  "inicio.mapa-do-sistema": "mapa dos módulos e telas, não lista de dados",
  "frota.acompanhamento":
    "grade por dia (Grade, Agora, Censo e Mapa); hipótese N3: sem CSV na Fase 1",
  "frota.analise": "análise em camadas (gráficos), não lista",
  "operacional.totem": "tela do totem (um passo), não lista",
  "pessoas.escala": "grade de marcação do mês, não lista",
  "resultados.visao-geral": "painel do mês (gráficos), não lista",
  "admin.demonstracao": "vitrine dos componentes, não lista",
};

export function ehLista(id: string): id is IdDaLista {
  return (
    (LISTAS_DE_PAINEL as readonly string[]).includes(id) ||
    (LISTAS_PROPRIAS as readonly string[]).includes(id)
  );
}

/** O que não é filtro (página, painel aberto, assistente, foco) não vai para o CSV. */
const FORA_DO_CSV = ["pagina", "tam", "espiar", "assistente", "foco", "placa", "linha"];

/**
 * O endereço do CSV da lista, com os filtros da tela (sem página nem painel). As Exceções já tinham a
 * rota própria (`/frota/excecoes/csv`) e seguem nela.
 */
export function enderecoDoCsv(id: IdDaLista, parametros?: URLSearchParams): string {
  const p = new URLSearchParams();
  for (const [chave, valor] of parametros ?? []) {
    if (!FORA_DO_CSV.includes(chave) && valor !== "") p.append(chave, valor);
  }
  const busca = p.toString();
  const base = id === "frota.excecoes" ? "/frota/excecoes/csv" : `/exportar/${id}`;
  return busca ? `${base}?${busca}` : base;
}

/** O nome do arquivo: a tela e o dia (`placas-2026-11-13.csv`). */
export function nomeDoArquivoCsv(id: string, hoje: string): string {
  return `${id.replace(/\./g, "-")}-${hoje}.csv`;
}
