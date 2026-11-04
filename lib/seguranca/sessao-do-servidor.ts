import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { Perfil } from "@/lib/navegacao/perfis";
import { criarClienteDoServidor } from "@/lib/supabase/servidor";
import { lerSessao, type Sessao } from "./sessao";

// A sessão no servidor, uma vez por pedido (cache do React). Cada página do sistema confere de novo
// aqui, além do proxy: sem sessão vai para /entrar; sem vínculo, para "acesso não liberado".

export const obterSessao = cache(async (): Promise<Sessao | null> => {
  // A sessão é do pedido: nada dela entra no que o Next pré-renderiza (o cliente do Supabase usa o
  // relógio, e o cacheComponents recusa Date.now() antes de um dado dinâmico).
  await connection();
  return lerSessao(await criarClienteDoServidor());
});

/** A sessão de quem está no sistema, com perfil. Redireciona quem não tem. */
export async function exigirSessao(): Promise<Sessao & { perfil: Perfil }> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar");
  if (!sessao.perfil) redirect("/acesso-nao-liberado");
  return sessao as Sessao & { perfil: Perfil };
}
