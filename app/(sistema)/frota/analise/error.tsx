"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDaAnalise(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDeLeitura {...props} oQue="a análise" titulo="Análise" />;
}
