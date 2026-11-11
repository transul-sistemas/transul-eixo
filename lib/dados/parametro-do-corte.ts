import { z } from "zod";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";

// O parâmetro do dia do corte da competência (config.parametro 'dia_do_corte_da_competencia').
// O staging das despesas não tem a DTNEG: a competência já veio com o corte aplicado pela v1, então o
// dia NÃO age nelas e a edição fica travada. A trava vale na tela, aqui no servidor e no banco
// (gatilho t10_corte_travado), e cai sozinha quando nucleo.staging_tem_dtneg() virar verdadeira.

const CHAVE = "dia_do_corte_da_competencia";

export const esquemaDiaDoCorte = z.object({ dia: z.number().int().min(1).max(28) });
export type EntradaDoDiaDoCorte = z.infer<typeof esquemaDiaDoCorte>;

export const MENSAGEM_DO_CORTE_TRAVADO =
  "O dia do corte não pode ser mudado agora: as despesas do staging já chegam com o corte já aplicado na origem (v1) e sem a data de negociação, então a mudança não alteraria nenhum lançamento. Peça para a ponte do Sankhya gravar a DTNEG; depois disso o parâmetro libera sozinho.";

type RespostaDoBanco<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

export interface ClienteDoCorte {
  schema(nome: "nucleo"): {
    rpc(funcao: "staging_tem_dtneg", argumentos: Record<string, never>): RespostaDoBanco<boolean>;
  };
  schema(nome: "config"): {
    from(tabela: "parametro"): {
      select(colunas: string): {
        eq(coluna: "chave", valor: string): { maybeSingle(): RespostaDoBanco<{ valor: string }> };
      };
      update(valores: { valor: string }): {
        eq(
          coluna: "chave",
          valor: string,
        ): {
          select(colunas: string): {
            maybeSingle(): RespostaDoBanco<{ chave: string; valor: string }>;
          };
        };
      };
    };
  };
}

export interface DiaDoCorte {
  /** O dia do parâmetro, lido do banco. */
  dia: number;
  /** Verdadeiro enquanto staging.despesa não tem a DTNEG. */
  travado: boolean;
}

async function stagingTemDtneg(c: ClienteDoCorte): Promise<boolean> {
  const { data, error } = await c.schema("nucleo").rpc("staging_tem_dtneg", {});
  if (error) throw new Error(`staging_tem_dtneg: ${error.message}`);
  return data === true;
}

export async function lerDiaDoCorte(c: ClienteDoCorte): Promise<DiaDoCorte> {
  const { data, error } = await c
    .schema("config")
    .from("parametro")
    .select("valor")
    .eq("chave", CHAVE)
    .maybeSingle();
  if (error) throw new Error(`parametro: ${error.message}`);
  return { dia: Number(data?.valor ?? 10), travado: !(await stagingTemDtneg(c)) };
}

/** Grava o dia do corte; recusa enquanto o staging não tem a DTNEG (o banco repete a recusa). */
export async function gravarDiaDoCorte(
  c: ClienteDoCorte,
  entrada: EntradaDoDiaDoCorte,
): Promise<ResultadoDaAcao<{ chave: string; valor: string }>> {
  if (!(await stagingTemDtneg(c))) {
    return erroDaAcao("conflito", { mensagem: MENSAGEM_DO_CORTE_TRAVADO });
  }
  const { data, error } = await c
    .schema("config")
    .from("parametro")
    .update({ valor: String(entrada.dia) })
    .eq("chave", CHAVE)
    .select("chave, valor")
    .maybeSingle();
  if (error) return erroDaAcao("falha", { mensagem: error.message });
  if (data === null) return erroDaAcao("nao_encontrado");
  return sucesso(data);
}
