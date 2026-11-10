import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import type { ParametrosDaBusca } from "../navegacao-da-lista";
import { PaginaDasOrdens, PaginaDasOrdensCarregando } from "./pagina-das-ordens";

export const metadata = metadataDaTela("/operacional/ordens-de-carregamento");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDasOrdensCarregando />}>
      <PaginaDasOrdens searchParams={searchParams} />
    </Suspense>
  );
}
