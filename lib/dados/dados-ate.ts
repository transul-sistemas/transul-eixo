// "Dados até": a data até onde o staging vai (nucleo.dados_do_staging_ate). Só o banco, com a sessão de
// quem usa; sem permissão em Resultados ou sem dados a resposta é nula e a tela não mostra o aviso.

/** As fontes do staging com data limite própria: o resultado (viagem e despesa), o abastecimento e a folha. */
export type FonteDosDadosAte = "resultado" | "abastecimento" | "folha";

const FUNCAO_DA_FONTE = {
  resultado: "dados_do_staging_ate",
  abastecimento: "abastecimento_ate",
  folha: "folha_ate",
} as const;

export interface ClienteDosDadosAte {
  schema(nome: "nucleo"): {
    rpc(
      funcao: (typeof FUNCAO_DA_FONTE)[FonteDosDadosAte],
      argumentos: Record<string, never>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
}

async function clienteDaSessao(): Promise<ClienteDosDadosAte> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDosDadosAte;
}

/**
 * A data limite `aaaa-mm-dd` de uma fonte, ou nulo. A folha é mensal: devolve o primeiro dia do último
 * mês carregado (a tela mostra só o mês). Falha na leitura não derruba a tela: o aviso só some.
 */
export async function lerDadosAteDaFonte(
  fonte: FonteDosDadosAte,
  cliente: () => Promise<ClienteDosDadosAte> = clienteDaSessao,
): Promise<string | null> {
  try {
    const c = await cliente();
    const { data, error } = await c.schema("nucleo").rpc(FUNCAO_DA_FONTE[fonte], {});
    if (error || typeof data !== "string") return null;
    return /^\d{4}-\d{2}-\d{2}/.test(data) ? data.slice(0, 10) : null;
  } catch {
    return null;
  }
}

/** A data limite do resultado (viagem e despesa). */
export function lerDadosAte(
  cliente: () => Promise<ClienteDosDadosAte> = clienteDaSessao,
): Promise<string | null> {
  return lerDadosAteDaFonte("resultado", cliente);
}
