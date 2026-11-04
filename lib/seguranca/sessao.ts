// A sessão do servidor (fatia 3.8): quem é o usuário (getUser) e o perfil dele, lido do banco a cada
// pedido (config.perfil_atual): perder o vínculo ou o perfil tira o acesso na hora, mesmo com o token
// ainda válido.

import { PERFIS, type Perfil } from "@/lib/navegacao/perfis";
import type { ClienteDaSessao } from "./cliente-da-sessao";
import { CODIGO_DO_PERFIL } from "./permissoes";

export interface Sessao {
  usuarioId: string;
  email: string | null;
  /** Nulo: logado, mas sem vínculo ativo no Eixo ("acesso não liberado"). */
  perfil: Perfil | null;
}

export function perfilDoCodigo(codigo: unknown): Perfil | null {
  return PERFIS.find((p) => CODIGO_DO_PERFIL[p] === codigo) ?? null;
}

export async function lerSessao(cliente: ClienteDaSessao): Promise<Sessao | null> {
  const { data } = await cliente.auth.getUser();
  const usuario = data.user;
  if (!usuario) return null;
  const { data: codigo, error } = await cliente.schema("config").rpc("perfil_atual");
  if (error) throw new Error(`Não foi possível ler o perfil: ${error.message}`);
  return { usuarioId: usuario.id, email: usuario.email ?? null, perfil: perfilDoCodigo(codigo) };
}
