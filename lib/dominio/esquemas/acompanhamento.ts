import { z } from "zod";
import { REGRAS_DAS_SIGLAS, type Sigla, SIGLAS } from "@/lib/dominio/status";

// Os esquemas da grade do Acompanhamento e da Carteira: os mesmos na tela (resolvedor do assistente)
// e no servidor (Server Action). O banco confere de novo (validade da sigla no contexto, permissão,
// carteira do mês).

const SIGLAS_LANCAVEIS = SIGLAS.filter((s) => REGRAS_DAS_SIGLAS[s].camada !== "baixada") as [
  Sigla,
  ...Sigla[],
];

export const esquemaLancarSituacao = z.object({
  ativoId: z.uuid({ message: "Escolha a placa." }),
  placa: z.string().min(1),
  sigla: z.enum(SIGLAS_LANCAVEIS, { message: "Escolha a situação do dia." }),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Escolha o dia." }),
});
export type EntradaLancarSituacao = z.infer<typeof esquemaLancarSituacao>;

const itemDaCarteira = z.object({
  ativoId: z.uuid(),
  placa: z.string().min(1),
  confere: z.boolean(),
  observacao: z.string().max(500, { message: "Use até 500 caracteres." }),
});

export const esquemaConfirmarCarteira = z
  .object({
    mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Escolha o mês." }),
    itens: z
      .array(itemDaCarteira)
      .min(1, { message: "Escolha ao menos uma placa." })
      .max(500, { message: "Confirme até 500 placas por vez." }),
  })
  .superRefine((dados, ctx) => {
    dados.itens.forEach((item, i) => {
      if (!item.confere && item.observacao.trim() === "") {
        ctx.addIssue({
          code: "custom",
          path: ["itens", i, "observacao"],
          message: `Diga o que não confere na placa ${item.placa}.`,
        });
      }
    });
  });
export type EntradaConfirmarCarteira = z.infer<typeof esquemaConfirmarCarteira>;
