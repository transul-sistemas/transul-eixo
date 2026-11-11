"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDosUsuarios(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErroDeLeitura
      {...props}
      oQue="os usuários"
      titulo="Usuários e perfis"
      descricao="Gerencia usuários, perfis e permissões."
    />
  );
}
