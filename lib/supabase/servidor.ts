import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configuracaoDoSupabase } from "./configuracao";
import { opcoesDoCookie } from "./cookies";

// O cliente do Supabase no servidor (Server Components, Server Actions e Route Handlers), com a sessão
// do usuário nos cookies: tudo o que ele faz passa pela RLS com a chave dele. Em Server Component não
// dá para gravar cookie; a renovação do token fica com o proxy.ts.
export async function criarClienteDoServidor() {
  const loja = await cookies();
  const { url, chave } = configuracaoDoSupabase();
  return createServerClient(url, chave, {
    cookies: {
      getAll: () => loja.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista)
            loja.set(name, value, opcoesDoCookie(options));
        } catch {
          // Server Component: o proxy grava o cookie renovado.
        }
      },
    },
  });
}
