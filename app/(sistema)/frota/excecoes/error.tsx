"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDaFila(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDeLeitura {...props} oQue="as exceções" titulo="Exceções" />;
}
