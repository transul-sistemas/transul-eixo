"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";
import { VoltarALista } from "./voltar-a-lista";

export default function ErroDaFichaDaPlaca(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDeLeitura {...props} oQue="a ficha" topo={<VoltarALista />} />;
}
