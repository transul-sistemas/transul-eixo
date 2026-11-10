"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { ErroDeCarregamento } from "@/components/tabela/estados";

/** Se uma tela de Parceiros falha, ela continua com o título e oferece tentar de novo. */
export function ErroDaTelaDeParceiros({
  titulo,
  oQue,
  error,
  reset,
}: {
  titulo: string;
  oQue: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <PaginaDeLeitura titulo={titulo}>
      <ErroDeCarregamento
        titulo={`Não foi possível carregar ${oQue}`}
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
