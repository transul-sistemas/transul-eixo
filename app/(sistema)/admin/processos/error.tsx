"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function Erro(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErroDeLeitura {...props} oQue="os processos e responsáveis" />;
}
