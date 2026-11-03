// Os dados do ativo com origem por campo (fatia 3.7). O Eixo é o dono destes campos; o Sankhya é só
// sinal. Espelho de `config.campo_corrigivel`, conferido contra a migração no Vitest e no pgTAP
// (70-dados-do-ativo.test.sql).

import type { TipoDeAtivo } from "@/lib/dados/placas-tipos";

export type OrigemDoCampo = "sankhya" | "derivada" | "informada" | "correcao_local";

export type CampoCorrigivel = {
  campo: string;
  colunaDaOrigem: string;
  rotulo: string;
  /** Os tipos em que o campo vazio fica pendente (nunca presumido). */
  pendenteEm: readonly TipoDeAtivo[];
  /** O campo que, preenchido, torna este pendente quando vazio (o código FIPE com valor FIPE). */
  pendenteCom: string | null;
};

const TODOS: readonly TipoDeAtivo[] = ["cavalo", "implemento", "equipamento", "caminhao", "apoio"];
const COM_TRACAO_E_IMPLEMENTO: readonly TipoDeAtivo[] = ["cavalo", "implemento", "caminhao"];

/** Na mesma ordem da migração. Massas em kg, inteiras. */
export const CAMPOS_CORRIGIVEIS: readonly CampoCorrigivel[] = [
  {
    campo: "modelo_id",
    colunaDaOrigem: "modelo_origem",
    rotulo: "Modelo",
    pendenteEm: TODOS,
    pendenteCom: null,
  },
  {
    campo: "carroceria_id",
    colunaDaOrigem: "carroceria_origem",
    rotulo: "Carroceria",
    pendenteEm: ["caminhao"],
    pendenteCom: null,
  },
  {
    campo: "eixos",
    colunaDaOrigem: "eixos_origem",
    rotulo: "Eixos",
    pendenteEm: COM_TRACAO_E_IMPLEMENTO,
    pendenteCom: null,
  },
  {
    campo: "tara_kg",
    colunaDaOrigem: "tara_kg_origem",
    rotulo: "Tara",
    pendenteEm: COM_TRACAO_E_IMPLEMENTO,
    pendenteCom: null,
  },
  {
    campo: "pbt_kg",
    colunaDaOrigem: "pbt_kg_origem",
    rotulo: "PBT",
    pendenteEm: COM_TRACAO_E_IMPLEMENTO,
    pendenteCom: null,
  },
  {
    campo: "cmt_kg",
    colunaDaOrigem: "cmt_kg_origem",
    rotulo: "CMT",
    pendenteEm: ["cavalo", "caminhao"],
    pendenteCom: null,
  },
  {
    campo: "ano_fabricacao",
    colunaDaOrigem: "ano_fabricacao_origem",
    rotulo: "Ano de fabricação",
    pendenteEm: TODOS,
    pendenteCom: null,
  },
  {
    campo: "ano_modelo",
    colunaDaOrigem: "ano_modelo_origem",
    rotulo: "Ano do modelo",
    pendenteEm: TODOS,
    pendenteCom: null,
  },
  {
    campo: "valor_fipe",
    colunaDaOrigem: "valor_fipe_origem",
    rotulo: "Valor FIPE",
    pendenteEm: ["cavalo", "caminhao"],
    pendenteCom: null,
  },
  {
    campo: "codigo_fipe",
    colunaDaOrigem: "codigo_fipe_origem",
    rotulo: "Código FIPE",
    pendenteEm: [],
    pendenteCom: "valor_fipe",
  },
  {
    campo: "valor_manual",
    colunaDaOrigem: "valor_manual_origem",
    rotulo: "Valor do ativo",
    pendenteEm: ["implemento", "equipamento", "apoio"],
    pendenteCom: null,
  },
];

/** Chaves: identificam a placa, a pessoa ou o parceiro e nunca aceitam correção local. */
export const CHAVES_SEM_CORRECAO = [
  "placa",
  "renavam",
  "cpf",
  "cnpj",
  "numero_de_serie",
  "chassi",
] as const;

export function aceitaCorrecaoLocal(campo: string): boolean {
  return CAMPOS_CORRIGIVEIS.some((c) => c.campo === campo);
}

/** Os campos vazios que o tipo (ou outro campo preenchido) exige, na ordem do catálogo. */
export function camposPendentes(
  tipo: TipoDeAtivo,
  valores: Partial<Record<string, unknown>>,
): string[] {
  return CAMPOS_CORRIGIVEIS.filter(
    (c) =>
      (c.pendenteEm.includes(tipo) ||
        (c.pendenteCom !== null && (valores[c.pendenteCom] ?? null) !== null)) &&
      (valores[c.campo] ?? null) === null,
  ).map((c) => c.campo);
}

/** Cavalo e caminhão: valor FIPE; os demais: valor manual, com fonte e data. */
export function valorDoAtivoPor(tipo: TipoDeAtivo): "fipe" | "manual" {
  return tipo === "cavalo" || tipo === "caminhao" ? "fipe" : "manual";
}

/** O ano do modelo é o de fabricação ou o seguinte (faltando um, nada a conferir). */
export function anosValidos(fabricacao: number | null, modelo: number | null): boolean {
  if (fabricacao === null || modelo === null) return true;
  return modelo === fabricacao || modelo === fabricacao + 1;
}
