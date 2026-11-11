"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDoAcompanhamento(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDeLeitura {...props} oQue="o acompanhamento" titulo="Acompanhamento" />;
}
