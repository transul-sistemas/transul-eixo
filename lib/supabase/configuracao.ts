// O endereço e a chave publicável do Supabase. A chave publicável vai ao navegador por natureza (só
// funciona com a RLS); a chave secreta nunca entra no app. Localmente vêm de .env.local, gerado por
// `pnpm env:local` a partir do `supabase status` (fora do Git); na Vercel, das variáveis do projeto.

export function configuracaoDoSupabase(): { url: string; chave: string } {
  // Acesso literal: o Next só embute no navegador as variáveis NEXT_PUBLIC_ escritas por extenso.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Localmente, rode `pnpm env:local` com o Supabase ligado.",
    );
  }
  return { url, chave };
}
