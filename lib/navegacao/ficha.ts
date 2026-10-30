// A ficha de toda raiz (placa, pessoa, operação, parceiro) tem as mesmas seis abas, na mesma
// ordem. A aba ativa mora na URL (`?aba=`); recarregar ou compartilhar devolve a mesma aba. O valor
// vem da URL e nunca é confiável: só os ids conhecidos passam, o resto cai no Resumo, sem erro.

export const PARAMETRO_DE_ABA = "aba";

export const ABAS_DA_FICHA = [
  { id: "resumo", nome: "Resumo", comConteudo: true },
  { id: "linha-do-tempo", nome: "Linha do tempo", comConteudo: true },
  { id: "documentos", nome: "Documentos", comConteudo: false },
  { id: "resultado", nome: "Resultado", comConteudo: false },
  { id: "mapa", nome: "Mapa", comConteudo: false },
  { id: "mapa-mental", nome: "Mapa mental", comConteudo: false },
] as const;

export type AbaId = (typeof ABAS_DA_FICHA)[number]["id"];

const IDS: readonly string[] = ABAS_DA_FICHA.map((aba) => aba.id);

function ehAba(valor: string | null): valor is AbaId {
  return valor !== null && IDS.includes(valor);
}

/** A aba do parâmetro `aba`, ou o Resumo se não há ou se não é uma aba conhecida. */
export function lerAba(parametros: URLSearchParams): AbaId {
  const valor = parametros.get(PARAMETRO_DE_ABA);
  return ehAba(valor) ? valor : "resumo";
}

/**
 * Parâmetros novos com a aba posta; nada mais muda. O Resumo é a aba padrão e não grava o
 * parâmetro. Aba desconhecida nunca é gravada: vale como o Resumo.
 */
export function comAba(parametros: URLSearchParams, aba: AbaId): URLSearchParams {
  const novos = new URLSearchParams(parametros);
  novos.delete(PARAMETRO_DE_ABA);
  if (ehAba(aba) && aba !== "resumo") novos.set(PARAMETRO_DE_ABA, aba);
  return novos;
}

/**
 * Para onde a tecla leva dentro da lista de abas: setas horizontais andam (e dão a volta), Home vai
 * à primeira e End à última. Qualquer outra tecla devolve `null` e não mexe nas abas.
 */
export function abaPorTecla(atual: AbaId, tecla: string): AbaId | null {
  const posicao = IDS.indexOf(atual);
  const total = IDS.length;
  const em = (i: number) => IDS[(i + total) % total] as AbaId;
  switch (tecla) {
    case "ArrowRight":
      return em(posicao + 1);
    case "ArrowLeft":
      return em(posicao - 1);
    case "Home":
      return em(0);
    case "End":
      return em(total - 1);
    default:
      return null;
  }
}

/**
 * A aba que o endereço atual pede, só se ele ainda é o da ficha (`caminhoDaFicha`). O Next mantém
 * a ficha anterior escondida no documento: um Voltar ou Avançar em outra página não pode mexer nela.
 */
export function abaDoEndereco(
  caminhoDaFicha: string,
  caminhoAtual: string,
  busca: string,
): AbaId | null {
  return caminhoAtual === caminhoDaFicha ? lerAba(new URLSearchParams(busca)) : null;
}
