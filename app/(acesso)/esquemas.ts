import { z } from "zod";

// Os esquemas das telas de acesso (fatia 3.8), os mesmos na tela e no servidor.

export const TAMANHO_MINIMO_DA_SENHA = 12;

export const ESQUEMA_DE_ENTRADA = z.object({
  email: z.email().max(320),
  senha: z.string().min(1).max(200),
  proximo: z.string().max(2000).optional(),
});

export const ESQUEMA_DE_RECUPERACAO = z.object({ email: z.email().max(320) });

export const ESQUEMA_DE_NOVA_SENHA = z
  .object({
    senha: z
      .string()
      .min(TAMANHO_MINIMO_DA_SENHA, {
        error: `A senha precisa de no mínimo ${TAMANHO_MINIMO_DA_SENHA} caracteres.`,
      })
      .max(200),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, {
    error: "A confirmação não é igual à senha.",
    path: ["confirmacao"],
  });
