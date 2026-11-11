"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDaVisaoGeral(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDeLeitura {...props} oQue="a visão geral" titulo="Visão geral" />;
}
