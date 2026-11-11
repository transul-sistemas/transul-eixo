"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDasOperacoes(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDeLeitura {...props} oQue="as operações" titulo="Operações" />;
}
