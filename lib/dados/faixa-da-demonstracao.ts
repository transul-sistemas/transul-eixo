// A faixa "banco em demonstração": liga pelo parâmetro de config.parametro que só a carga de
// demonstração (scripts/demo-carregar.ts) grava. A restauração do backup real remove o parâmetro, e a
// faixa some sozinha. Qualquer pessoa com sessão lê o parâmetro (política parametro_ler); a falha na
// leitura nunca derruba a tela: a faixa só deixa de aparecer.

/** A chave do parâmetro (a carga usa a mesma, em scripts/demo-dados.ts; há teste que as iguala). */
export const CHAVE_DA_FAIXA = "banco_em_demonstracao";

type RespostaDoBanco<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

export interface ClienteDaFaixa {
  schema(nome: "config"): {
    from(tabela: "parametro"): {
      select(colunas: "valor"): {
        eq(coluna: "chave", valor: string): { maybeSingle(): RespostaDoBanco<{ valor: string }> };
      };
    };
  };
}

async function clienteDaSessao(): Promise<ClienteDaFaixa> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDaFaixa;
}

/** Verdadeiro só quando o parâmetro existe e vale "sim". */
export async function bancoEmDemonstracao(
  cliente: () => Promise<ClienteDaFaixa> = clienteDaSessao,
): Promise<boolean> {
  try {
    const c = await cliente();
    const { data, error } = await c
      .schema("config")
      .from("parametro")
      .select("valor")
      .eq("chave", CHAVE_DA_FAIXA)
      .maybeSingle();
    return !error && data?.valor === "sim";
  } catch {
    return false;
  }
}
