"use server";

import { z } from "zod";
import { lerSessao } from "@/lib/seguranca/sessao";
import { detalheRegistrado, type DetalheTecnico } from "./leitura";

// ação pública: não há permissão módulo × ação que sirva (é diagnóstico, não dado de módulo); o corpo confere
// o perfil e só devolve a função e o código a Administrador e Diretoria. Os outros perfis recebem nulo.
const entrada = z.object({ id: z.string().regex(/^[a-z0-9]{4,16}$/) });

export async function detalheDoErroDeLeitura(bruto: unknown): Promise<DetalheTecnico | null> {
  const lido = entrada.safeParse(bruto);
  if (!lido.success) return null;
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  const sessao = await lerSessao(await criarClienteDoServidor()).catch(() => null);
  if (sessao?.perfil !== "Administrador" && sessao?.perfil !== "Diretoria") return null;
  return detalheRegistrado(lido.data.id) ?? null;
}
