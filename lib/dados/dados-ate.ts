// "Dados até": a data até onde o staging vai (nucleo.dados_do_staging_ate). Só o banco, com a sessão de
// quem usa; sem permissão em Resultados ou sem dados a resposta é nula e a tela não mostra o aviso.

export interface ClienteDosDadosAte {
  schema(nome: "nucleo"): {
    rpc(
      funcao: "dados_do_staging_ate",
      argumentos: Record<string, never>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
}

async function clienteDaSessao(): Promise<ClienteDosDadosAte> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDosDadosAte;
}

/** A data limite `aaaa-mm-dd`, ou nulo. Falha na leitura não derruba a tela: o aviso só some. */
export async function lerDadosAte(
  cliente: () => Promise<ClienteDosDadosAte> = clienteDaSessao,
): Promise<string | null> {
  try {
    const c = await cliente();
    const { data, error } = await c.schema("nucleo").rpc("dados_do_staging_ate", {});
    if (error || typeof data !== "string") return null;
    return /^\d{4}-\d{2}-\d{2}/.test(data) ? data.slice(0, 10) : null;
  } catch {
    return null;
  }
}
