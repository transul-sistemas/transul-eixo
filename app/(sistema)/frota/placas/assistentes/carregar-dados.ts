import { unstable_rethrow } from "next/navigation";
import { type DadosDosAssistentes, dadosDosAssistentes } from "@/lib/dados/assistentes";
import { fonteDeEscrita } from "@/lib/dados/fonte";
import { gestorAtual } from "@/lib/seguranca/gestor-atual";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";

/** Os dados dos assistentes, ou nulo (indisponíveis: a tela segue sem os botões). */
export type DadosDaTelaDosAssistentes = DadosDosAssistentes | null;

/** O gestor de quem usa, ou nulo (sem pessoa ligada ao login: não recebe nem conclui). */
async function gestorOuNulo(): Promise<string | null> {
  try {
    return await gestorAtual();
  } catch (erro) {
    unstable_rethrow(erro);
    return null;
  }
}

/**
 * Os dados dos assistentes da Frota para a tela que os hospeda, com a chave dos rascunhos de quem
 * entrou e o gestor de quem usa. Um erro devolve `null`: a tela segue sem os botões, em vez de cair.
 */
export async function carregarDadosDosAssistentes(pedido: {
  assistente: string | null;
  placa: string | null;
  hoje: string;
  carregarDaPlaca?: boolean;
}): Promise<DadosDaTelaDosAssistentes> {
  try {
    const [{ usuarioId }, gestorId] = await Promise.all([exigirSessao(), gestorOuNulo()]);
    return await dadosDosAssistentes(await fonteDeEscrita(pedido.hoje), {
      ...pedido,
      usuario: usuarioId,
      gestorId,
    });
  } catch (erro) {
    // O redirecionamento da sessão (sem login, sem vínculo) não é erro: segue para o Next.
    unstable_rethrow(erro);
    console.error("dados dos assistentes indisponíveis:", erro);
    return null;
  }
}
