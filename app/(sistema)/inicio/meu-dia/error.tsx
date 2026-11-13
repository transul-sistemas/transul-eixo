"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDoMeuDia(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDeLeitura {...props} oQue="o seu dia" titulo="Meu dia" />;
}
