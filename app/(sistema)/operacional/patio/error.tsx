"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDoPatio(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDeLeitura {...props} oQue="o pátio" titulo="Pátio" />;
}
