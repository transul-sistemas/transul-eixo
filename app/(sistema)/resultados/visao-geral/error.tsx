"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { ErroDeCarregamento } from "@/components/tabela/estados";

/** Se a Visão geral falha, a tela continua com o título e oferece tentar de novo. */
export default function ErroDaVisaoGeral({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <PaginaDeLeitura titulo="Visão geral">
      <ErroDeCarregamento
        titulo="Não foi possível carregar a visão geral"
        descricao="O banco não respondeu. Confira a conexão e tente de novo; se continuar, avise quem cuida do sistema."
        codigo={error.digest}
        pendente={pendente}
        aoTentar={() =>
          iniciar(() => {
            router.refresh();
            reset();
          })
        }
      />
    </PaginaDeLeitura>
  );
}
