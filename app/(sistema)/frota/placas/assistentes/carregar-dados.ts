import { type DadosDosAssistentes, dadosDosAssistentes } from "@/lib/dados/assistentes";
import { fonteDeEscrita } from "@/lib/dados/fonte";

/**
 * Os dados dos assistentes da Frota para a tela que os hospeda. Sem fonte de escrita (hoje, só a de
 * exemplo existe) devolve `null`: a tela segue sem os botões de assistente, em vez de cair.
 */
export async function carregarDadosDosAssistentes(pedido: {
  assistente: string | null;
  placa: string | null;
  hoje: string;
  carregarDaPlaca?: boolean;
}): Promise<DadosDosAssistentes | null> {
  try {
    return await dadosDosAssistentes(await fonteDeEscrita(pedido.hoje), pedido);
  } catch (erro) {
    console.error("dados dos assistentes indisponíveis:", erro);
    return null;
  }
}
