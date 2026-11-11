"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDosParceiros(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDeLeitura {...props} oQue="os parceiros" titulo="Parceiros" />;
}
