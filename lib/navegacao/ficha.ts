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

const IDS: readonly AbaId[] = ABAS_DA_FICHA.map((aba) => aba.id);

/**
 * Uma raiz pode ter abas próprias além das seis (a operação tem Placas e Pessoas): as funções abaixo
 * recebem os ids da ficha, e sem eles valem as seis de sempre. A primeira aba é a padrão.
 */
function idsPadrao<Id extends string>(): readonly Id[] {
  return IDS as unknown as readonly Id[];
}

function ehAba<Id extends string>(valor: string | null, ids: readonly Id[]): valor is Id {
  return valor !== null && (ids as readonly string[]).includes(valor);
}

/** A aba do parâmetro `aba`, ou a primeira (o Resumo) se não há ou se não é uma aba conhecida. */
export function lerAba<Id extends string = AbaId>(
  parametros: URLSearchParams,
  ids: readonly Id[] = idsPadrao<Id>(),
): Id {
  const valor = parametros.get(PARAMETRO_DE_ABA);
  return ehAba(valor, ids) ? valor : (ids[0] as Id);
}

/**
 * Parâmetros novos com a aba posta; nada mais muda. O Resumo é a aba padrão e não grava o
 * parâmetro. Aba desconhecida nunca é gravada: vale como o Resumo.
 */
export function comAba<Id extends string = AbaId>(
  parametros: URLSearchParams,
  aba: NoInfer<Id>,
  ids: readonly Id[] = idsPadrao<Id>(),
): URLSearchParams {
  const novos = new URLSearchParams(parametros);
  novos.delete(PARAMETRO_DE_ABA);
  if (ehAba(aba, ids) && aba !== ids[0]) novos.set(PARAMETRO_DE_ABA, aba);
  return novos;
}

/**
 * Para onde a tecla leva dentro da lista de abas: setas horizontais andam (e dão a volta), Home vai
 * à primeira e End à última. Qualquer outra tecla devolve `null` e não mexe nas abas.
 */
export function abaPorTecla<Id extends string = AbaId>(
  atual: NoInfer<Id>,
  tecla: string,
  ids: readonly Id[] = idsPadrao<Id>(),
): Id | null {
  const posicao = ids.indexOf(atual);
  const total = ids.length;
  const em = (i: number) => ids[(i + total) % total] as Id;
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
export function abaDoEndereco<Id extends string = AbaId>(
  caminhoDaFicha: string,
  caminhoAtual: string,
  busca: string,
  ids: readonly Id[] = idsPadrao<Id>(),
): Id | null {
  return caminhoAtual === caminhoDaFicha ? lerAba(new URLSearchParams(busca), ids) : null;
}
