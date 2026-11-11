"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDaCarteira(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDeLeitura {...props} oQue="a carteira" titulo="Carteira" />;
}
