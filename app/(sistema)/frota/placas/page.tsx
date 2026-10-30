import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDePlacas,
  PaginaDePlacasCarregando,
  type ParametrosDaBusca,
} from "./pagina-de-placas";

export const metadata = metadataDaTela("/frota/placas");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDePlacasCarregando />}>
      <PaginaDePlacas searchParams={searchParams} />
    </Suspense>
  );
}
