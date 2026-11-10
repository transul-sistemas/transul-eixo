import { z } from "zod";

// O esquema Zod do assistente "Editar operação" (Operações › ficha): o MESMO arquivo valida na tela e
// na Server Action. O Eixo é dono do nome, do tipo e da base (cidade e UF) da operação; a filial é a
// garagem da base, calculada.

export const TIPOS_DE_OPERACAO = [
  "operacao",
  "parada",
  "administrativa",
  "holding",
  "acionista",
] as const;

export const esquemaEditarOperacao = z.object({
  id: z.uuid({ error: "Operação inválida. Feche o assistente e abra de novo." }),
  versao: z
    .number({ error: "Falta a versão da operação que você viu." })
    .int()
    .min(1, { error: "Falta a versão da operação que você viu." }),
  nome: z
    .string({ error: "Informe o nome." })
    .trim()
    .min(2, { error: "Use pelo menos 2 caracteres no nome." })
    .max(80, { error: "Use até 80 caracteres no nome." }),
  tipo: z.enum(TIPOS_DE_OPERACAO, { error: "Escolha o tipo da operação." }),
  baseCidade: z.string().trim().max(80, { error: "Use até 80 caracteres na cidade." }),
  baseUf: z
    .string()
    .trim()
    .toUpperCase()
    .refine((uf) => uf === "" || /^[A-Z]{2}$/.test(uf), {
      error: "Use a sigla da UF com duas letras, como SP.",
    }),
});
export type EntradaEditarOperacao = z.infer<typeof esquemaEditarOperacao>;
