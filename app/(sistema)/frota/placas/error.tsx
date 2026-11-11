"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDaListaDePlacas(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErroDeLeitura
      {...props}
      oQue="as placas"
      titulo="Placas"
      descricao="Lista todas as placas e abre a ficha de cada uma."
    />
  );
}
