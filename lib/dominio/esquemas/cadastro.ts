import { z } from "zod";

// Esquemas Zod dos assistentes de Cadastros (catálogos) e de Administração (acesso do usuário): o
// MESMO arquivo valida na tela e na Server Action.

/** Os catálogos de que o Eixo é dono e que se incluem, editam e arquivam aqui. CR e a régua não. */
export const CATALOGOS_EDITAVEIS = ["carroceria", "marca", "filial", "operacao"] as const;
export type CatalogoEditavel = (typeof CATALOGOS_EDITAVEIS)[number];

const catalogo = z.enum(CATALOGOS_EDITAVEIS, { error: "Escolha um catálogo que se edita aqui." });

const nome = z
  .string({ error: "Informe o nome." })
  .trim()
  .min(2, { error: "Use pelo menos 2 caracteres no nome." })
  .max(80, { error: "Use até 80 caracteres no nome." });

const versao = z
  .number({ error: "Falta a versão do registro que você viu." })
  .int()
  .min(1, { error: "Falta a versão do registro que você viu." });

const id = z.uuid({ error: "Registro inválido. Feche o assistente e abra de novo." });

export const esquemaIncluirItem = z.object({ catalogo, nome });
export type EntradaIncluirItem = z.infer<typeof esquemaIncluirItem>;

export const esquemaEditarItem = z.object({ catalogo, nome, id, versao });
export type EntradaEditarItem = z.infer<typeof esquemaEditarItem>;

export const esquemaArquivarItem = z.object({
  catalogo,
  id,
  versao,
  motivo: z
    .string({ error: "Informe o motivo." })
    .trim()
    .min(5, { error: "Conte o motivo em pelo menos 5 caracteres." })
    .max(300, { error: "Use até 300 caracteres no motivo." }),
});
export type EntradaArquivarItem = z.infer<typeof esquemaArquivarItem>;

/** Mudar o perfil e a situação de um usuário que já existe (o login nasce fora do app). */
export const esquemaMudarAcesso = z.object({
  pessoaId: id,
  perfil: z.string({ error: "Escolha o perfil." }).trim().min(1, { error: "Escolha o perfil." }),
  ativo: z.boolean({ error: "Escolha a situação." }),
  versao,
});
export type EntradaMudarAcesso = z.infer<typeof esquemaMudarAcesso>;
