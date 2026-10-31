// Rascunho do assistente: por pessoa e navegador (localStorage), validado na leitura e sem dados
// sensíveis, até a Fase 3 (aí vai para o banco). Nada aqui lança: sem armazenamento, o assistente
// funciona sem rascunho.

/** O que o rascunho usa do `localStorage`. `null` = sem armazenamento (modo privado, bloqueado). */
export type ArmazemDeRascunho = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const LIMITE_DE_CARACTERES = 20_000;

export function chaveDoRascunho(usuario: string, assistente: string, registro?: string): string {
  return `eixo-rascunho:${usuario}:${assistente}:${registro ?? "novo"}`;
}

export interface RascunhoParaGuardar {
  versaoDoEsquema: number;
  passo: number;
  valores: Record<string, unknown>;
  /** Campos que nunca vão para o rascunho. */
  camposSensiveis?: readonly string[];
}

export function guardarRascunho(
  armazem: ArmazemDeRascunho | null,
  chave: string,
  { versaoDoEsquema, passo, valores, camposSensiveis = [] }: RascunhoParaGuardar,
): "salvo" | "indisponivel" {
  if (armazem === null) return "indisponivel";
  const permitidos = Object.fromEntries(
    Object.entries(valores).filter(([campo]) => !camposSensiveis.includes(campo)),
  );
  const texto = JSON.stringify({ versaoDoEsquema, passo, valores: permitidos });
  if (texto.length > LIMITE_DE_CARACTERES) return "indisponivel";
  try {
    armazem.setItem(chave, texto);
    return "salvo";
  } catch {
    return "indisponivel"; // cota cheia ou modo privado
  }
}

export type LeituraDoRascunho<V> =
  | { tipo: "nenhum" }
  | { tipo: "rascunho"; valores: V; passo: number }
  | { tipo: "descartado"; motivo: "versao" | "invalido" };

export function lerRascunho<V>(
  armazem: ArmazemDeRascunho | null,
  chave: string,
  {
    versaoDoEsquema,
    validar,
  }: { versaoDoEsquema: number; validar: (valores: unknown) => V | null },
): LeituraDoRascunho<V> {
  if (armazem === null) return { tipo: "nenhum" };
  let bruto: string | null;
  try {
    bruto = armazem.getItem(chave);
  } catch {
    return { tipo: "nenhum" };
  }
  if (bruto === null) return { tipo: "nenhum" };

  const descartar = (motivo: "versao" | "invalido"): LeituraDoRascunho<V> => {
    apagarRascunho(armazem, chave);
    return { tipo: "descartado", motivo };
  };
  let dado: unknown;
  try {
    dado = JSON.parse(bruto);
  } catch {
    return descartar("invalido");
  }
  if (typeof dado !== "object" || dado === null || Array.isArray(dado))
    return descartar("invalido");
  const r = dado as Record<string, unknown>;
  if (typeof r.versaoDoEsquema !== "number" || !Number.isInteger(r.versaoDoEsquema)) {
    return descartar("invalido");
  }
  if (r.versaoDoEsquema !== versaoDoEsquema) return descartar("versao");
  if (typeof r.passo !== "number" || !Number.isInteger(r.passo) || r.passo < 0) {
    return descartar("invalido");
  }
  if (typeof r.valores !== "object" || r.valores === null || Array.isArray(r.valores)) {
    return descartar("invalido");
  }
  const valores = validar(r.valores);
  return valores === null ? descartar("invalido") : { tipo: "rascunho", valores, passo: r.passo };
}

export function apagarRascunho(armazem: ArmazemDeRascunho | null, chave: string): void {
  if (armazem === null) return;
  try {
    armazem.removeItem(chave);
  } catch {
    // Sem como apagar: o rascunho fica e é validado de novo na próxima leitura.
  }
}
