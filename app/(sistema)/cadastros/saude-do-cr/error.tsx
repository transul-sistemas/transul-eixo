"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDaSaudeDoCr(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErroDeLeitura
      {...props}
      oQue="a saúde do CR"
      titulo="Saúde do CR"
      descricao="Placa sem CR, CR sem operação, dois CRs do mesmo tipo e lançamento sem CR, com dono e prazo."
    />
  );
}
