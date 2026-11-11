"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDoAbastecimento(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDeLeitura {...props} oQue="o abastecimento" titulo="Abastecimento" />;
}
