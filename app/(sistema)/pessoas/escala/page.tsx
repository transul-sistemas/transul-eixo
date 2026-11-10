import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import type { ParametrosDaBusca } from "../lista/pagina-de-pessoas";
import { PaginaDaEscala, PaginaDaEscalaCarregando } from "./pagina-da-escala";

export const metadata = metadataDaTela("/pessoas/escala");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDaEscalaCarregando />}>
      <PaginaDaEscala searchParams={searchParams} />
    </Suspense>
  );
}
