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

/** O pedaço do cliente que lê a pessoa de quem entrou (nos testes, um simulado com esta forma). */
export interface ClienteDaPessoa {
  schema(esquema: "config"): {
    rpc(funcao: "usuario_atual"): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  schema(esquema: "nucleo"): {
    from(tabela: "pessoa_para_leitura"): {
      select(colunas: "nome"): {
        eq(
          coluna: "id",
          valor: string,
        ): {
          maybeSingle(): PromiseLike<{
            data: { nome: string | null } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
}

/** A pessoa de quem entrou (fatia 3.9a): o id (o gestor da carteira) e o nome, ou nulo sem vínculo. */
export async function lerPessoaDaSessao(
  cliente: ClienteDaPessoa,
): Promise<{ pessoaId: string; nome: string } | null> {
  const { data: pessoaId, error } = await cliente.schema("config").rpc("usuario_atual");
  if (error) throw new Error(`Não foi possível ler a pessoa: ${error.message}`);
  if (typeof pessoaId !== "string") return null;
  const { data, error: erroDoNome } = await cliente
    .schema("nucleo")
    .from("pessoa_para_leitura")
    .select("nome")
    .eq("id", pessoaId)
    .maybeSingle();
  if (erroDoNome) throw new Error(`Não foi possível ler o nome: ${erroDoNome.message}`);
  return { pessoaId, nome: data?.nome ?? "Sem nome" };
}
