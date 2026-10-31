import type { ReactNode } from "react";

/**
 * A casca da ficha de toda raiz (placa, pessoa, operação, parceiro): cabeçalho, linha do tempo e,
 * nos filhos, as abas. Não sabe nada da raiz: cada uma entra com os seus encaixes. Largura total,
 * a página rola (a ficha não é lista).
 */
export function FichaDaRaiz({
  cabecalho,
  linhaDoTempo,
  children,
}: {
  cabecalho: ReactNode;
  linhaDoTempo: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
      {cabecalho}
      {linhaDoTempo}
      {children}
    </div>
  );
}
