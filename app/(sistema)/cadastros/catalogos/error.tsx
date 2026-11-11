"use client";

import { ErroDeLeitura } from "@/components/estados/erro-de-leitura";

export default function ErroDosCatalogos(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErroDeLeitura
      {...props}
      oQue="o catálogo"
      titulo="Catálogos e parâmetros"
      descricao="Mantém catálogos, regras e parâmetros, como o dia do corte da competência."
    />
  );
}
