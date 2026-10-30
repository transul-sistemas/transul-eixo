// Preferências da pessoa para a tabela: tamanho da página, densidade, colunas e a ordem delas.
// Ficam num cookie (para o servidor já renderizar do jeito certo, sem piscar) e, no login (Fase 3),
// passam para o banco. O cookie não é confiável: tudo é validado na leitura, campo a campo, e o que
// estiver errado volta ao padrão sem erro.

export const NOME_DO_COOKIE_DE_PLACAS = "eixo-tabela-placas";

export const TAMANHOS_DE_PAGINA = [25, 50, 100] as const;
export type TamanhoDePagina = (typeof TAMANHOS_DE_PAGINA)[number];

export const DENSIDADES = ["compacta", "confortavel"] as const;
export type Densidade = (typeof DENSIDADES)[number];

export interface PreferenciasDaTabela {
  tam: TamanhoDePagina;
  densidade: Densidade;
  /** Colunas visíveis, na ordem em que vieram; `null` = as do padrão da tela. */
  colunas: string[] | null;
  /** Ordem das colunas; `null` = a do padrão da tela. */
  ordemDasColunas: string[] | null;
}

export const PREFERENCIAS_PADRAO: PreferenciasDaTabela = {
  tam: 25,
  densidade: "compacta",
  colunas: null,
  ordemDasColunas: null,
};

// O servidor recebe o cookie já decodificado, então o limite vale para o texto decodificado (um
// valor legítimo, com todas as colunas escolhidas e ordenadas, tem menos de 500 caracteres).
const TAMANHO_MAXIMO_DO_TEXTO = 1000;
const TAMANHO_MAXIMO_DO_VALOR = 3 * TAMANHO_MAXIMO_DO_TEXTO;

function decodificar(valor: string): string | null {
  if (valor.trimStart().startsWith("{")) return valor;
  try {
    return decodeURIComponent(valor);
  } catch {
    return null;
  }
}

function listaDeColunas(bruto: unknown, validas: readonly string[]): string[] | null {
  if (!Array.isArray(bruto)) return null;
  const escolhidas = [
    ...new Set(bruto.filter((c): c is string => typeof c === "string" && validas.includes(c))),
  ];
  return escolhidas.length > 0 ? escolhidas : null;
}

/** Nunca lança: valor ausente, corrompido ou adulterado devolve o padrão (campo a campo). */
export function lerPreferencias(
  valor: string | undefined,
  colunasValidas: readonly string[],
): PreferenciasDaTabela {
  if (!valor || valor.length > TAMANHO_MAXIMO_DO_VALOR) return { ...PREFERENCIAS_PADRAO };
  const texto = decodificar(valor);
  if (texto === null || texto.length > TAMANHO_MAXIMO_DO_TEXTO) return { ...PREFERENCIAS_PADRAO };
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { ...PREFERENCIAS_PADRAO };
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    return { ...PREFERENCIAS_PADRAO };
  }
  const campos = bruto as Record<string, unknown>;
  const tam = (TAMANHOS_DE_PAGINA as readonly unknown[]).includes(campos.tam)
    ? (campos.tam as TamanhoDePagina)
    : PREFERENCIAS_PADRAO.tam;
  const densidade = (DENSIDADES as readonly unknown[]).includes(campos.densidade)
    ? (campos.densidade as Densidade)
    : PREFERENCIAS_PADRAO.densidade;
  return {
    tam,
    densidade,
    colunas: listaDeColunas(campos.colunas, colunasValidas),
    ordemDasColunas: listaDeColunas(campos.ordemDasColunas, colunasValidas),
  };
}

/** O valor do cookie: JSON codificado, sem espaço, vírgula, aspas nem ponto e vírgula. */
export function serializarPreferencias(preferencias: PreferenciasDaTabela): string {
  return encodeURIComponent(JSON.stringify(preferencias));
}

const UM_ANO_EM_SEGUNDOS = 60 * 60 * 24 * 365;

/** O texto para `document.cookie`. Em https leva `Secure`; em http (desenvolvimento) não. */
export function montarCookie(
  preferencias: PreferenciasDaTabela,
  nome: string,
  protocolo: string,
): string {
  const partes = [
    `${nome}=${serializarPreferencias(preferencias)}`,
    "path=/",
    `max-age=${UM_ANO_EM_SEGUNDOS}`,
    "SameSite=Lax",
  ];
  if (protocolo === "https:") partes.push("Secure");
  return partes.join("; ");
}
