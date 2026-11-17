import { z } from "zod";
import type { TipoDeAtivo } from "@/lib/dados/placas-tipos";
import { normalizarPlaca, placaNormalizadaValida } from "../placa";
import { siglaValidaNoContexto } from "../situacao";
import { SIGLAS, SIGLAS_DE_BAIXA, type Sigla } from "../status";
import { validarRenavam } from "./placa";

// Esquemas Zod dos assistentes da ficha da placa: mudar situação, engatar, desatrelar e corrigir
// placa. O MESMO arquivo valida na tela e no servidor. Datas em `aaaa-mm-ddThh:mm` (São Paulo), com
// `agora` entrando de fora para a regra ser pura e testável.

const placa = z
  .string({ error: "Informe a placa." })
  .transform(normalizarPlaca)
  .refine(placaNormalizadaValida, {
    error: "Placa inválida. Use três letras e quatro caracteres, como ABC1D23 ou ABC1234.",
  });

const versao = z
  .number({ error: "Falta a versão do registro que você viu." })
  .int()
  .min(1, { error: "Falta a versão do registro que você viu." });

const DATA_E_HORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function dataEHoraValida(texto: string): boolean {
  const m = DATA_E_HORA.exec(texto);
  if (!m) return false;
  const [a, mes, d, h, min] = m.slice(1).map(Number) as [number, number, number, number, number];
  const data = new Date(Date.UTC(a, mes - 1, d, h, min));
  return (
    data.getUTCFullYear() === a &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === d &&
    h < 24 &&
    min < 60
  );
}

const quando = (agora: string) =>
  z
    .string({ error: "Informe a data e a hora." })
    .refine(dataEHoraValida, {
      error: "Data ou hora inválida. Use uma data real e a hora de 00:00 a 23:59.",
    })
    .refine((q) => q <= agora, { error: "A data e a hora não podem ser no futuro." });

// ---------- mudar situação ----------

/**
 * As siglas que a pessoa pode escolher para a placa: as que a régua aceita para o tipo, no contexto
 * (solta ou em conjunto). A baixa (VND, SUC) tem o seu caminho e nunca entra aqui.
 */
export function siglasParaMudar(tipo: TipoDeAtivo, emConjunto: boolean): Sigla[] {
  return SIGLAS.filter(
    (s) => !SIGLAS_DE_BAIXA.includes(s) && siglaValidaNoContexto(s, tipo, emConjunto),
  );
}

export function esquemaMudarSituacao({
  tipo,
  emConjunto,
  agora,
}: {
  tipo: TipoDeAtivo;
  emConjunto: boolean;
  agora: string;
}) {
  const validas = siglasParaMudar(tipo, emConjunto);
  return z.object({
    placa,
    sigla: z
      .string({ error: "Escolha a situação." })
      .refine((s) => (validas as string[]).includes(s), {
        error: emConjunto
          ? "Esta situação não vale para um conjunto. Escolha uma da lista."
          : "Esta situação não vale para uma placa solta. Escolha uma da lista.",
      })
      .transform((s) => s as Sigla),
    quando: quando(agora),
  });
}
export type EntradaMudarSituacao = z.infer<ReturnType<typeof esquemaMudarSituacao>>;

// ---------- engatar e desatrelar ----------

export function esquemaEngatar({ agora }: { agora: string }) {
  return z
    .object({
      /** O cavalo. */
      placa,
      /** O implemento que entra. */
      implemento: placa,
      posicao: z
        .number({ error: "Informe a posição." })
        .int({ error: "A posição é um número inteiro." })
        .min(1, { error: "A posição vai de 1 a 3." })
        .max(3, { error: "A posição vai de 1 a 3." }),
      quando: quando(agora),
    })
    .refine((d) => d.placa !== d.implemento, {
      path: ["implemento"],
      error: "Escolha outra placa: o cavalo não engata nele mesmo.",
    });
}
export type EntradaEngatar = z.infer<ReturnType<typeof esquemaEngatar>>;

/** Engatar vários implementos de uma vez: na ordem, a partir da primeira posição livre. */
export function esquemaEngatarVarios({ agora }: { agora: string }) {
  return z
    .object({
      /** O cavalo. */
      placa,
      implementos: z
        .array(placa, { error: "Escolha os implementos." })
        .min(1, { error: "Escolha ao menos um implemento para engatar." })
        .max(3, { error: "Um conjunto tem no máximo três unidades." }),
      primeiraPosicao: z
        .number({ error: "Informe a posição." })
        .int({ error: "A posição é um número inteiro." })
        .min(1, { error: "A posição vai de 1 a 3." })
        .max(3, { error: "A posição vai de 1 a 3." }),
      quando: quando(agora),
    })
    .refine((d) => !d.implementos.includes(d.placa), {
      path: ["implementos"],
      error: "Tire o cavalo da lista: ele não engata nele mesmo.",
    })
    .refine((d) => new Set(d.implementos).size === d.implementos.length, {
      path: ["implementos"],
      error: "Cada implemento entra uma vez só.",
    })
    .refine((d) => d.primeiraPosicao + d.implementos.length - 1 <= 3, {
      path: ["implementos"],
      error: "O conjunto passaria de três unidades. Escolha menos implementos.",
    });
}
export type EntradaEngatarVarios = z.infer<ReturnType<typeof esquemaEngatarVarios>>;

export function esquemaDesatrelar({ agora }: { agora: string }) {
  return z.object({
    /** O cavalo. */
    placa,
    implementos: z
      .array(placa, { error: "Escolha o que desatrelar." })
      .min(1, { error: "Escolha ao menos um implemento para desatrelar." })
      .max(3, { error: "Um conjunto tem no máximo três unidades." }),
    quando: quando(agora),
  });
}
export type EntradaDesatrelar = z.infer<ReturnType<typeof esquemaDesatrelar>>;

// ---------- corrigir placa ----------

/** Completar o RENAVAM e o número de série, e corrigir os eixos e a carroceria, com o motivo. */
export const esquemaCorrigirPlaca = z
  .object({
    placa,
    versaoDaPlaca: versao,
    motivo: z
      .string({ error: "Informe o motivo." })
      .trim()
      .min(1, { error: "Informe o motivo." })
      .max(300, { error: "Use até 300 caracteres no motivo." }),
    renavam: z
      .string()
      .refine(validarRenavam, {
        error: "RENAVAM inválido. Confira os 11 dígitos, com o dígito final.",
      })
      .transform((t) => t.replace(/[.\-\s]/g, "").padStart(11, "0"))
      .optional(),
    numeroDeSerie: z
      .string()
      .trim()
      .min(3, { error: "O número de série tem ao menos 3 caracteres." })
      .max(40, { error: "Use até 40 caracteres no número de série." })
      .transform((t) => t.toUpperCase())
      .optional(),
    eixos: z
      .number({ error: "Informe os eixos em número." })
      .int({ error: "Os eixos são um número inteiro." })
      .min(1, { error: "Informe de 1 a 9 eixos." })
      .max(9, { error: "Informe de 1 a 9 eixos." })
      .optional(),
    carroceriaId: z.string().trim().min(1).optional(),
  })
  .refine(
    (d) =>
      d.renavam !== undefined ||
      d.numeroDeSerie !== undefined ||
      d.eixos !== undefined ||
      d.carroceriaId !== undefined,
    { path: ["renavam"], error: "Preencha ao menos um campo para completar ou corrigir." },
  );
export type EntradaCorrigirPlaca = z.infer<typeof esquemaCorrigirPlaca>;
