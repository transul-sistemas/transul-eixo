import { z } from "zod";

// Os esquemas do líder e dos pedidos de aprovação (inventário 31 e 37), os MESMOS na tela e no servidor.
// O banco confere de novo: só o líder da operação libera (nucleo.liberar_posicao_do_dia); só a Diretoria
// decide e quem pede não decide (nucleo.decidir_aprovacao).

const DIA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Escolha o dia." });
const MOTIVO = z
  .string()
  .trim()
  .min(10, { message: "Explique o motivo (10 caracteres ou mais)." })
  .max(500, { message: "Use até 500 caracteres." });

/** 31. Liberar a posição do dia: o líder abre a porta de um gestor no dia, com motivo. */
export const esquemaLiberarPosicao = z.object({
  gestorId: z.uuid({ message: "Escolha o gestor." }),
  dia: DIA,
  motivo: MOTIVO,
});
export type EntradaLiberarPosicao = z.infer<typeof esquemaLiberarPosicao>;

export const TIPOS_DE_PEDIDO = ["mes_fechado", "permissao", "outro"] as const;
export const NOMES_DOS_TIPOS_DE_PEDIDO: Record<(typeof TIPOS_DE_PEDIDO)[number], string> = {
  mes_fechado: "Mês fechado",
  permissao: "Permissão",
  outro: "Outro",
};

/** 37. Pedir aprovação ou permissão: qualquer pessoa com login pede; a Diretoria decide. */
export const esquemaPedirAprovacao = z.object({
  tipo: z.enum(TIPOS_DE_PEDIDO, {
    message: "Escolha o que pede: mês fechado, permissão ou outro.",
  }),
  descricao: z
    .string()
    .trim()
    .min(10, { message: "Explique o que pede (10 caracteres ou mais)." })
    .max(500, { message: "Use até 500 caracteres." }),
  referencia: z
    .string()
    .trim()
    .max(120, { message: "Use até 120 caracteres." })
    .transform((v) => (v === "" ? null : v)),
});
export type EntradaPedirAprovacao = z.infer<typeof esquemaPedirAprovacao>;

/** 37. Decidir o pedido: aprovado ou recusado; recusar pede o motivo. */
export const esquemaDecidirAprovacao = z
  .object({
    pedidoId: z.uuid({ message: "Escolha o pedido." }),
    versao: z.number().int().min(1),
    decisao: z.enum(["aprovado", "recusado"], { message: "Decida: aprovado ou recusado." }),
    motivo: z.string().trim().max(500, { message: "Use até 500 caracteres." }),
  })
  .superRefine((v, ctx) => {
    if (v.decisao === "recusado" && v.motivo.length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["motivo"],
        message: "Recusar pede o motivo (10 caracteres ou mais).",
      });
    }
  });
export type EntradaDecidirAprovacao = z.infer<typeof esquemaDecidirAprovacao>;
