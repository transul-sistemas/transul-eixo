import { z } from "zod";
import { cpfValido, digitosDoCpf } from "@/lib/dominio/documento";

// Os esquemas Zod dos assistentes de Pessoas (Cadastrar pessoa, Editar pessoa) e do mini-assistente
// da Escala (Marcar dia): o MESMO arquivo valida na tela e na Server Action. O banco confere de novo
// (CPF, duplicata, vínculo sem sobreposição, versão).

/** As funções do catálogo pessoas.funcao (o banco é a fonte; aqui, o espelho para os chips). */
export const FUNCOES_DA_PESSOA = [
  { id: "motorista", nome: "Motorista" },
  { id: "operador", nome: "Operador de máquina" },
  { id: "ajudante", nome: "Ajudante" },
  { id: "mecanico", nome: "Mecânico" },
  { id: "lider", nome: "Líder de operação" },
  { id: "administrativo", nome: "Administrativo" },
] as const;

export type FuncaoDaPessoa = (typeof FUNCOES_DA_PESSOA)[number]["id"];
const IDS_DAS_FUNCOES = FUNCOES_DA_PESSOA.map((f) => f.id) as [FuncaoDaPessoa, ...FuncaoDaPessoa[]];

/** As marcações da escala: uma por pessoa e dia. */
export const SIGLAS_DA_ESCALA = [
  { id: "T", nome: "Trabalho" },
  { id: "F", nome: "Folga" },
  { id: "FE", nome: "Férias" },
  { id: "AT", nome: "Atestado" },
] as const;

export type SiglaDaEscala = (typeof SIGLAS_DA_ESCALA)[number]["id"];
const IDS_DAS_SIGLAS = SIGLAS_DA_ESCALA.map((s) => s.id) as [SiglaDaEscala, ...SiglaDaEscala[]];

const DATA = /^\d{4}-\d{2}-\d{2}$/;

const nome = z
  .string({ error: "Informe o nome." })
  .trim()
  .min(2, { error: "Use pelo menos 2 letras no nome." })
  .max(120, { error: "Use até 120 caracteres no nome." });

const email = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    error: "Confira o e-mail: ele precisa de um @ e de um domínio, como nome@empresa.com.br.",
  });

const operacaoId = z.union([z.literal(""), z.uuid({ error: "Escolha a operação da lista." })]);
const funcao = z.union([z.literal(""), z.enum(IDS_DAS_FUNCOES, { error: "Escolha a função." })]);
const data = z.union([
  z.literal(""),
  z.string().regex(DATA, { error: "Informe a data como dd/mm/aaaa." }),
]);

/** Com operação, a função é obrigatória (e o início, quando `exigirInicio`). */
function conferirVinculo(
  v: { operacaoId: string; funcao: string; inicio: string },
  contexto: z.RefinementCtx,
  exigirInicio: boolean,
) {
  if (v.operacaoId === "") return;
  if (v.funcao === "") {
    contexto.addIssue({
      code: "custom",
      path: ["funcao"],
      message: "Escolha a função na operação.",
    });
  }
  if (exigirInicio && v.inicio === "") {
    contexto.addIssue({
      code: "custom",
      path: ["inicio"],
      message: "Informe desde quando a pessoa está na operação.",
    });
  }
}

export const esquemaCadastrarPessoa = z
  .object({
    nome,
    cpf: z
      .string({ error: "Informe o CPF." })
      .refine(cpfValido, { error: "Este CPF não é válido. Confira os 11 dígitos." })
      .transform(digitosDoCpf),
    email,
    operacaoId,
    funcao,
    inicio: data,
  })
  .superRefine((v, contexto) => conferirVinculo(v, contexto, true));
export type EntradaCadastrarPessoa = z.infer<typeof esquemaCadastrarPessoa>;

export const esquemaEditarPessoa = z
  .object({
    id: z.uuid({ error: "Pessoa inválida. Feche o assistente e abra de novo." }),
    versao: z
      .number({ error: "Falta a versão da pessoa que você viu." })
      .int()
      .min(1, { error: "Falta a versão da pessoa que você viu." }),
    nome,
    email,
    operacaoId,
    funcao,
    inicio: data,
  })
  .superRefine((v, contexto) => conferirVinculo(v, contexto, false));
export type EntradaEditarPessoa = z.infer<typeof esquemaEditarPessoa>;

export const esquemaMarcarEscala = z.object({
  pessoaId: z.uuid({ error: "Pessoa inválida. Feche e abra a escala de novo." }),
  operacaoId: z.uuid({ error: "Operação inválida. Feche e abra a escala de novo." }),
  dia: z.string().regex(DATA, { error: "Dia inválido. Feche e abra a escala de novo." }),
  sigla: z.enum(IDS_DAS_SIGLAS, { error: "Escolha a marcação do dia." }),
  versao: z.number().int().min(1).nullable(),
});
export type EntradaMarcarEscala = z.infer<typeof esquemaMarcarEscala>;
