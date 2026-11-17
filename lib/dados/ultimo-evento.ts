import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ClienteDeEscrita, resultadoDoErro } from "./escrita-do-banco";
import type { UltimoEvento } from "./ultimo-evento-tipos";

export type { UltimoEvento } from "./ultimo-evento-tipos";

// A2: o que a grade precisa além de lib/dados/lancar-o-dia.ts. Lançar a situação num instante escolhido
// (nucleo.lancar_situacao_na_hora) e o último evento ativo da placa (para "Corrigir o último evento"),
// lido de nucleo.evento_de_status com a RLS de quem usa (política evento_de_status_ler).

interface ClienteDeLeitura {
  schema(esquema: "nucleo"): {
    from(tabela: "evento_de_status"): {
      select(colunas: string): {
        eq(
          coluna: string,
          valor: string,
        ): {
          is(
            coluna: string,
            valor: null,
          ): {
            order(
              coluna: string,
              opcoes: { ascending: boolean },
            ): {
              order(
                coluna: string,
                opcoes: { ascending: boolean },
              ): {
                limit(n: number): PromiseLike<{ data: unknown; error: { message: string } | null }>;
              };
            };
          };
        };
      };
    };
  };
}

export async function lerUltimoEvento(
  cliente: ClienteDeEscrita,
  ativoId: string,
): Promise<UltimoEvento | null> {
  const c = cliente as unknown as ClienteDeLeitura;
  const { data, error } = await c
    .schema("nucleo")
    .from("evento_de_status")
    .select("id, sigla, camada, em")
    .eq("ativo_id", ativoId)
    .is("excluido_em", null)
    .order("em", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw new Error(`evento_de_status: ${error.message}`);
  return ((data as UltimoEvento[] | null) ?? [])[0] ?? null;
}

export async function lancarSituacaoNaHora(
  cliente: ClienteDeEscrita,
  e: { ativoId: string; sigla: string; em: string },
): Promise<ResultadoDaAcao<{ eventoId: string }>> {
  const { data, error } = await cliente.schema("nucleo").rpc("lancar_situacao_na_hora", {
    p_ativo_id: e.ativoId,
    p_sigla: e.sigla,
    p_em: e.em,
  });
  if (error) return resultadoDoErro(error);
  return sucesso({ eventoId: data as string });
}
