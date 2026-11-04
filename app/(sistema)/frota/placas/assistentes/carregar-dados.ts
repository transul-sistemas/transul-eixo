import { unstable_rethrow } from "next/navigation";
import { type DadosDosAssistentes, dadosDosAssistentes } from "@/lib/dados/assistentes";
import { ErroDeGravacaoEmBreve, fonteDeEscrita } from "@/lib/dados/fonte";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";

/** Os dados dos assistentes, ou "em-breve" (modo banco, até a 3.9b), ou nulo (indisponíveis). */
export type DadosDaTelaDosAssistentes = DadosDosAssistentes | "em-breve" | null;

/**
 * Os dados dos assistentes da Frota para a tela que os hospeda, com a chave dos rascunhos de quem
 * entrou. No modo banco as gravações entram na 3.9b: "em-breve" (os botões aparecem desabilitados,
 * com o aviso). Outro erro devolve `null`: a tela segue sem os botões, em vez de cair.
 */
export async function carregarDadosDosAssistentes(pedido: {
  assistente: string | null;
  placa: string | null;
  hoje: string;
  carregarDaPlaca?: boolean;
}): Promise<DadosDaTelaDosAssistentes> {
  try {
    const { usuarioId } = await exigirSessao();
    return await dadosDosAssistentes(await fonteDeEscrita(pedido.hoje), {
      ...pedido,
      usuario: usuarioId,
    });
  } catch (erro) {
    // O redirecionamento da sessão (sem login, sem vínculo) não é erro: segue para o Next.
    unstable_rethrow(erro);
    if (erro instanceof ErroDeGravacaoEmBreve) return "em-breve";
    console.error("dados dos assistentes indisponíveis:", erro);
    return null;
  }
}
