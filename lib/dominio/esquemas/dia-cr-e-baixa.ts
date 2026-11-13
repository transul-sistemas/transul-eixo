import { z } from "zod";

// Os esquemas das ações do gestor que gravam pelas funções da n1-banco (o MESMO na tela e na Server
// Action): A2 (Lançar o dia, Programado, lançar na hora, Corrigir o último evento), Trocar CR, Baixa com
// quatro olhos e os resolvedores da Saúde do CR. O banco confere de novo (permissão, escopo e regra).

const id = z.string().uuid({ error: "Escolha um item da lista." });
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Informe a data." });
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Informe a hora (hh:mm)." });
const sigla = z.string().trim().min(2, { error: "Escolha a situação." }).max(4);
const motivo = z
  .string({ error: "Informe o motivo." })
  .trim()
  .min(1, { error: "Informe o motivo." })
  .max(300, { error: "Use até 300 caracteres no motivo." });

/** O instante de um dia e hora em São Paulo (sem horário de verão desde 2019). */
export function instanteEmSaoPaulo(d: string, h: string): string {
  return `${d}T${h}:00-03:00`;
}

// ---------- A2 ----------

export const esquemaLancarODia = z.object({
  ativos: z
    .array(id)
    .min(1, { error: "Escolha ao menos um conjunto." })
    .max(100, { error: "Lance até 100 conjuntos por vez." }),
  sigla,
  dia,
  hora,
});

export const esquemaProgramar = z.object({ ativoId: id, dia, sigla, hora });
export const esquemaConfirmarProgramada = z.object({
  programadaId: id,
  versao: z.number().int().positive(),
});
export const esquemaCancelarProgramada = z.object({ programadaId: id, motivo });
export const esquemaLancarNaHora = z.object({ ativoId: id, sigla, dia, hora });
export const esquemaCorrigirUltimo = z.object({
  eventoId: id,
  motivo,
  novaSigla: z.string().trim().max(4).nullable(),
});

/** "ZDM0A00: motivo" por recusado, na ordem que o banco devolveu. */
export function textoDosRecusados(
  recusados: readonly { ativo_id: string; motivo: string }[],
  placaDe: (ativoId: string) => string | undefined,
): string[] {
  return recusados.map((r) => `${placaDe(r.ativo_id) ?? "Placa"}: ${r.motivo}`);
}

// ---------- Trocar CR ----------

export const ORIGENS_DA_DATA = ["informada", "observada", "derivada"] as const;
export const esquemaTrocarCr = z.object({
  ativoId: id,
  crNovoId: id,
  dia,
  motivo,
  origemDaData: z.enum(ORIGENS_DA_DATA),
  versao: z.number().int().positive().nullable(),
});

// ---------- Baixa ----------

export const MOTIVOS_DA_BAIXA = ["venda", "sinistro", "sucata", "devolucao"] as const;
export const NOMES_DOS_MOTIVOS_DA_BAIXA: Record<(typeof MOTIVOS_DA_BAIXA)[number], string> = {
  venda: "Venda",
  sinistro: "Sinistro",
  sucata: "Sucata",
  devolucao: "Devolução",
};
export const esquemaPedirBaixa = z.object({
  ativoId: id,
  motivo: z.enum(MOTIVOS_DA_BAIXA, { error: "Escolha o motivo da baixa." }),
  dia,
  justificativa: motivo,
  documento: z.string().trim().max(300).nullable(),
});
export const esquemaDecidirBaixa = z
  .object({
    pedidoId: id,
    versao: z.number().int().positive(),
    decisao: z.enum(["aprovar", "recusar"], { error: "Escolha aprovar ou recusar." }),
    motivo: z.string().trim().max(300),
  })
  .refine((d) => d.decisao === "aprovar" || d.motivo !== "", {
    path: ["motivo"],
    error: "Recusar pede o motivo.",
  });
export const esquemaCancelarBaixa = z.object({ pedidoId: id });

// ---------- Saúde do CR ----------

export const PROBLEMAS_DA_SAUDE = [
  "placa_sem_cr",
  "cr_sem_operacao",
  "dois_do_mesmo_tipo",
  "lancamento_sem_cr",
] as const;
export const esquemaLigarCr = z.object({ crId: id, operacaoId: id, dia, motivo });
export const esquemaEncerrarVinculo = z.object({
  vinculoId: id,
  versao: z.number().int().positive(),
  dia,
  motivo,
});
export const esquemaClassificarCentro = z
  .object({
    codcencus: z.string().trim().min(1),
    decisao: z.enum(["criar_cr", "sem_destino"], { error: "Escolha o que fazer." }),
    codigo: z.string().trim().max(20).nullable(),
    nome: z.string().trim().max(120).nullable(),
    motivo,
  })
  .refine((d) => d.decisao === "sem_destino" || (d.codigo ?? "") !== "", {
    path: ["codigo"],
    error: "Criar o CR pede o código.",
  });
export const esquemaAtribuirDono = z.object({
  problema: z.enum(PROBLEMAS_DA_SAUDE),
  referencia: z.string().min(1),
  donoId: id,
  prazo: dia.nullable(),
});
