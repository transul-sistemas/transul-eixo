"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDasTarefas(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDeLeitura {...props} oQue="as tarefas" titulo="Tarefas" />;
}
