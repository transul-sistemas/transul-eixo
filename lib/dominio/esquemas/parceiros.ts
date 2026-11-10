import { z } from "zod";
import { documentoValido, normalizarDocumento } from "@/lib/dominio/cpf-cnpj";
import { normalizarPlaca, placaNormalizadaValida } from "@/lib/dominio/placa";

// Os esquemas de Parceiros (cadastro, conciliação e locação): os mesmos na tela (resolvedor do
// assistente) e no servidor (Server Action). O banco confere de novo: a permissão, o documento sem
// duplicata, o agrupador, a linha com diferença, a placa da frota e a vigência sem sobreposição.

export const TIPOS_DE_PARCEIRO = ["acionista", "agregado", "locador"] as const;
export type TipoDeParceiro = (typeof TIPOS_DE_PARCEIRO)[number];

export const NOMES_DOS_TIPOS_DE_PARCEIRO: Record<TipoDeParceiro, string> = {
  acionista: "Acionista",
  agregado: "Agregado",
  locador: "Locador",
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const esquemaCadastrarParceiro = z.object({
  documento: z
    .string()
    .refine(documentoValido, {
      message: "O CPF ou CNPJ não é válido. Confira os números (CPF com 11, CNPJ com 14).",
    })
    .transform(normalizarDocumento),
  nome: z
    .string()
    .trim()
    .min(1, { message: "Diga o nome ou a razão social do parceiro." })
    .max(200, { message: "Use até 200 caracteres." }),
  tipos: z
    .array(z.enum(TIPOS_DE_PARCEIRO))
    .min(1, { message: "Escolha ao menos um tipo: acionista, agregado ou locador." }),
  codparc: z
    .string()
    .trim()
    .regex(/^\d{0,12}$/, { message: "O CODPARC tem só números." })
    .transform((v) => (v === "" ? null : Number(v))),
  agrupadorId: z.union([z.uuid(), z.literal("")]).transform((v) => (v === "" ? null : v)),
});
export type EntradaCadastrarParceiro = z.infer<typeof esquemaCadastrarParceiro>;

export const esquemaJustificarDiferenca = z.object({
  crId: z.uuid({ message: "Escolha a linha da conciliação." }),
  mes: z.string().regex(/^\d{4}-\d{2}$/, { message: "Escolha o mês da conciliação." }),
  motivo: z
    .string()
    .trim()
    .min(10, { message: "Explique o motivo da diferença (10 caracteres ou mais)." })
    .max(500, { message: "Use até 500 caracteres." }),
});
export type EntradaJustificarDiferenca = z.infer<typeof esquemaJustificarDiferenca>;

export const esquemaCadastrarLocacao = z
  .object({
    parceiroId: z.uuid({ message: "Escolha o parceiro." }),
    placa: z.string().transform(normalizarPlaca).refine(placaNormalizadaValida, {
      message: "Digite a placa completa, com 3 letras e 4 números ou letras (ex.: ABC1D23).",
    }),
    inicio: z.string().regex(DATA, { message: "Diga o dia em que a locação começa." }),
    fim: z.union([z.string().regex(DATA), z.literal("")]).transform((v) => (v === "" ? null : v)),
    valorMensalCentavos: z
      .number()
      .int()
      .positive({ message: "Diga o valor mensal da locação, maior que zero." }),
  })
  .superRefine((dados, ctx) => {
    if (dados.fim !== null && dados.fim <= dados.inicio) {
      ctx.addIssue({
        code: "custom",
        path: ["fim"],
        message: "O fim da locação vem depois do início.",
      });
    }
  });
export type EntradaCadastrarLocacao = z.infer<typeof esquemaCadastrarLocacao>;

export const esquemaEncerrarLocacao = z
  .object({
    locacaoId: z.uuid(),
    versao: z.number().int().positive(),
    inicio: z.string().regex(DATA),
    fim: z.string().regex(DATA, { message: "Diga o dia em que a placa deixa de estar locada." }),
    motivo: z
      .string()
      .trim()
      .min(1, { message: "Diga o motivo do encerramento." })
      .max(500, { message: "Use até 500 caracteres." }),
  })
  .superRefine((dados, ctx) => {
    if (DATA.test(dados.fim) && dados.fim <= dados.inicio) {
      ctx.addIssue({
        code: "custom",
        path: ["fim"],
        message: "O encerramento vem depois do início da locação.",
      });
    }
  });
export type EntradaEncerrarLocacao = z.infer<typeof esquemaEncerrarLocacao>;
