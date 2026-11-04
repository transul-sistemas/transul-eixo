import { modoDosDados } from "@/lib/dados/fonte";
import { obterPessoaDaSessao } from "./sessao-do-servidor";

/**
 * O gestor de frota de quem está usando o sistema (fatia 3.9a): a pessoa da sessão, lida do banco com
 * a chave do próprio usuário. No modo exemplo, o gestor de destino do pedido de transferência de
 * exemplo (o armazém de exemplo não conhece as pessoas do banco).
 */
export async function gestorAtual(): Promise<string> {
  if (modoDosDados() === "exemplo") return "gestor-2";
  const pessoa = await obterPessoaDaSessao();
  if (!pessoa) throw new Error("Quem está usando não tem vínculo com uma pessoa do Eixo.");
  return pessoa.pessoaId;
}
