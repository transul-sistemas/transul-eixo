import { z } from "zod";

// A porta da Posição do dia (M2, docs/posicao-do-dia.md): o contador "N de M preenchidos", as respostas de
// um toque ("Continua em <cidade de ontem>", "No pátio da filial") e o esquema da resposta (o MESMO na
// tela e na Server Action). O banco confere de novo (nucleo.registrar_posicao_do_dia).

interface ConjuntoMinimo {
  ativo_id: string;
  sigla: string | null;
  cidade_da_filial: { id: number } | null;
  ontem: { cidade_id: number | null; sem_sinal: boolean } | null;
  hoje: { versao: number } | null;
}

export function contadorDaPorta(conjuntos: readonly { hoje: unknown }[]) {
  const respondidos = conjuntos.filter((c) => c.hoje !== null).length;
  return { respondidos, total: conjuntos.length, podeConcluir: respondidos === conjuntos.length };
}

export const esquemaRespostaDaPosicao = z
  .object({
    ativoId: z.string().uuid(),
    dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cidadeId: z.number().int().positive().nullable(),
    semSinal: z.boolean(),
    motivo: z.string().trim().max(300).nullable(),
    sigla: z.string().max(4).nullable(),
    confirmouAlerta: z.boolean(),
    versao: z.number().int().positive().nullable(),
  })
  .refine((r) => r.semSinal || r.cidadeId !== null, {
    path: ["cidadeId"],
    error: "Escolha a cidade, ou marque Sem sinal.",
  })
  .refine((r) => !r.semSinal || (r.motivo ?? "").trim() !== "", {
    path: ["motivo"],
    error: "Diga por que está sem sinal.",
  });
export type RespostaValidada = z.infer<typeof esquemaRespostaDaPosicao>;

function resposta(c: ConjuntoMinimo, dia: string, cidadeId: number): RespostaValidada {
  return {
    ativoId: c.ativo_id,
    dia,
    cidadeId,
    semSinal: false,
    motivo: null,
    sigla: c.sigla,
    confirmouAlerta: false,
    versao: c.hoje?.versao ?? null,
  };
}

/** "Continua em <cidade de ontem>": nulo quando ontem não tem cidade. */
export function respostaContinua(c: ConjuntoMinimo, dia: string): RespostaValidada | null {
  const cidade = c.ontem && !c.ontem.sem_sinal ? c.ontem.cidade_id : null;
  return cidade === null ? null : resposta(c, dia, cidade);
}

/** "No pátio da filial": nulo quando a filial não tem cidade. */
export function respostaNaFilial(c: ConjuntoMinimo, dia: string): RespostaValidada | null {
  return c.cidade_da_filial === null ? null : resposta(c, dia, c.cidade_da_filial.id);
}
