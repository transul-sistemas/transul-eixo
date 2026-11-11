"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

// Último recurso: qualquer rota do sistema sem `error.tsx` próprio. A causa vem do `digest` quando a leitura
// falhou por um ErroDeLeitura; erro de outra origem cai em "inesperado".
export default function ErroDoSistema(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDeLeitura {...props} oQue="esta tela" />;
}
