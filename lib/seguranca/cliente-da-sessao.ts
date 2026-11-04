// O pedaço do cliente do Supabase que a sessão e a permissão usam: o usuário (getUser, que valida no
// Auth; nunca getSession) e as funções de acesso do banco (config.pode, config.perfil_atual), chamadas
// com a chave do próprio usuário. Nos testes, um cliente simulado com esta mesma forma.

export interface ClienteDaSessao {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: unknown;
    }>;
  };
  schema(esquema: "config"): {
    rpc(
      funcao: string,
      argumentos?: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
}
