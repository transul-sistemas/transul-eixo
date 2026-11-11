"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDasOrdens(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErroDeLeitura {...props} oQue="as ordens de carregamento" titulo="Ordens de carregamento" />
  );
}
