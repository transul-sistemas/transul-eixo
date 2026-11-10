"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ErroDeCarregamento } from "@/components/tabela/estados";
import { VoltarALista } from "./voltar-a-lista";

/** Se a ficha da operação falha, a tela continua com o caminho de volta e oferece tentar de novo. */
export default function ErroDaFichaDaOperacao({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
      <div>
        <VoltarALista />
      </div>
      <ErroDeCarregamento
        titulo="Não foi possível carregar a ficha"
        descricao="A ficha não respondeu. Confira a conexão e tente de novo; se continuar, avise quem cuida do sistema."
        codigo={error.digest}
        pendente={pendente}
        aoTentar={() =>
          iniciar(() => {
            router.refresh();
            reset();
          })
        }
      />
    </div>
  );
}
