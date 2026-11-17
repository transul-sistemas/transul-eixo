import { z } from "zod";
import { normalizarPlaca, placaNormalizadaValida } from "@/lib/dominio/placa";

// Os esquemas do Operacional (Pátio, Totem e Ordens de carregamento): os mesmos na tela (resolvedor do
// assistente) e no servidor (Server Action). O banco confere de novo: a permissão, a filial da custódia
// vigente e a situação da placa (DOp → ACe → CAr → CAn → ETc).

export const esquemaRegistrarChegada = z.object({
  placa: z.string().transform(normalizarPlaca).refine(placaNormalizadaValida, {
    message: "Digite a placa completa, com 3 letras e 4 números ou letras (ex.: ABC1D23).",
  }),
});
export type EntradaRegistrarChegada = z.infer<typeof esquemaRegistrarChegada>;

/** As ações do pátio, com o nome do botão e a situação de onde cada uma parte. */
export const ACOES_DO_PATIO = {
  aceitar: { botao: "Aceitar placa", feito: "Placa aceita.", de: ["DOp"], para: "ACe" },
  "criar-ordem": { botao: "Criar ordem", feito: "Ordem criada.", de: ["ACe"], para: "CAr" },
  concluir: {
    botao: "Concluir carregamento",
    feito: "Carregamento concluído.",
    de: ["CAr"],
    para: "CAn",
  },
  liberar: { botao: "Liberar viagem", feito: "Viagem liberada.", de: ["CAn"], para: "ETc" },
  devolver: {
    botao: "Devolver ao gestor",
    feito: "Placa devolvida ao gestor.",
    de: ["DOp", "ACe"],
    para: "PÁT",
  },
} as const;
export type AcaoDoPatio = keyof typeof ACOES_DO_PATIO;

const ORDEM_DAS_ACOES: readonly AcaoDoPatio[] = [
  "aceitar",
  "criar-ordem",
  "concluir",
  "liberar",
  "devolver",
];

/** O que o pátio pode fazer com a placa nesta situação. */
export function acoesPossiveis(sigla: string): AcaoDoPatio[] {
  return ORDEM_DAS_ACOES.filter((a) => (ACOES_DO_PATIO[a].de as readonly string[]).includes(sigla));
}

/** As ações que avançam a placa pela função do pátio (criar a ordem tem o seu próprio assistente). */
export const ACOES_DE_AVANCAR = ["aceitar", "concluir", "liberar", "devolver"] as const;
export type AcaoDeAvancar = (typeof ACOES_DE_AVANCAR)[number];

export const esquemaAvancarNoPatio = z
  .object({
    ativoId: z.uuid({ message: "Escolha a placa." }),
    placa: z.string().min(1),
    acao: z.enum(ACOES_DE_AVANCAR, { message: "Escolha o que fazer com a placa." }),
    motivo: z.string().max(500, { message: "Use até 500 caracteres." }),
  })
  .superRefine((dados, ctx) => {
    if (dados.acao === "devolver" && dados.motivo.trim() === "") {
      ctx.addIssue({
        code: "custom",
        path: ["motivo"],
        message: "Diga o motivo de devolver a placa ao gestor.",
      });
    }
  });
export type EntradaAvancarNoPatio = z.infer<typeof esquemaAvancarNoPatio>;

/** As ações que o pátio faz em lote (devolver pede o motivo de cada placa: fica fora do lote). */
export const ACOES_EM_LOTE = ["aceitar", "concluir", "liberar"] as const;
export type AcaoEmLote = (typeof ACOES_EM_LOTE)[number];

/** Avançar várias placas de uma vez: cada placa é um pedido independente (uma recusa não derruba as outras). */
export const esquemaAvancarEmLote = z.object({
  acao: z.enum(ACOES_EM_LOTE, { message: "Escolha o que fazer com as placas." }),
  placas: z
    .array(z.object({ ativoId: z.uuid(), placa: z.string().min(1) }))
    .min(1, { message: "Escolha pelo menos uma placa." })
    .max(100, { message: "Escolha até 100 placas por vez." }),
});
export type EntradaAvancarEmLote = z.infer<typeof esquemaAvancarEmLote>;

const FEITO_EM_LOTE: Record<AcaoEmLote, [string, string]> = {
  aceitar: ["aceita", "aceitas"],
  concluir: ["com carregamento concluído", "com carregamento concluído"],
  liberar: ["liberada", "liberadas"],
};

/** "3 de 4 placas aceitas": o resultado do lote. */
export function textoDoLote(acao: AcaoEmLote, feitas: number, total: number): string {
  const [um, varios] = FEITO_EM_LOTE[acao];
  return `${feitas} de ${total} ${total === 1 ? `placa ${um}` : `placas ${varios}`}.`;
}

/** Criar a ordem: a data prevista de saída é hoje ou depois (hoje em São Paulo, `aaaa-mm-dd`). */
export function esquemaCriarOrdem(hoje: string) {
  return z.object({
    ativoId: z.uuid({ message: "Escolha a placa da fila." }),
    placa: z.string(),
    operacaoId: z.uuid({ message: "Escolha a operação." }),
    destino: z
      .string()
      .trim()
      .min(1, { message: "Diga o destino da carga." })
      .max(120, { message: "Use até 120 caracteres." }),
    dataPrevista: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Escolha a data prevista de saída." })
      .refine((d) => d >= hoje, { message: "A data prevista de saída é hoje ou depois." }),
  });
}
export type EntradaCriarOrdem = z.infer<ReturnType<typeof esquemaCriarOrdem>>;
