// Confirmar a carteira do mês em 3 passos (docs/fichas-de-tela/frota-confirmar-carteira.md): cada placa
// recebe uma de três respostas. As três viram o par (confere, observação) que nucleo.confirmar_carteira
// já grava; a observação leva o rótulo da resposta para quem lê depois.

export type Resposta = "comigo" | "nao-e-minha" | "corrigir";

export interface RespostaDaPlaca {
  ativoId: string;
  placa: string;
  resposta: Resposta;
  /** O que não confere (só vale em "nao-e-minha" e "corrigir"). */
  nota: string;
}

export const ROTULOS_DAS_RESPOSTAS: Record<Resposta, string> = {
  comigo: "Está comigo",
  "nao-e-minha": "Não é minha",
  corrigir: "Corrigir",
};

export interface ItemParaGravar {
  ativoId: string;
  placa: string;
  confere: boolean;
  observacao: string;
}

export function itensParaGravar(respostas: readonly RespostaDaPlaca[]): ItemParaGravar[] {
  return respostas.map(({ ativoId, placa, resposta, nota }) => {
    if (resposta === "comigo") return { ativoId, placa, confere: true, observacao: "" };
    const texto = nota.trim();
    return {
      ativoId,
      placa,
      confere: false,
      observacao: texto === "" ? "" : `${ROTULOS_DAS_RESPOSTAS[resposta]}: ${texto}`,
    };
  });
}

/** "12 de 14 confirmadas": quantas estão comigo, o total e quantas pedem resolver. */
export function progressoDaCarteira(respostas: readonly RespostaDaPlaca[]) {
  const confirmadas = respostas.filter((r) => r.resposta === "comigo").length;
  return { confirmadas, total: respostas.length, aResolver: respostas.length - confirmadas };
}

/** As linhas que pedem atenção vêm no topo; entre iguais, a ordem original. */
export function ordemDeAtencao<T extends { resposta: Resposta }>(lista: readonly T[]): T[] {
  return [
    ...lista.filter((r) => r.resposta !== "comigo"),
    ...lista.filter((r) => r.resposta === "comigo"),
  ];
}
