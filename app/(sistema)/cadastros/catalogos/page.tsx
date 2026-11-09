import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDeCatalogos,
  PaginaDeCatalogosCarregando,
  type ParametrosDaBusca,
} from "./pagina-de-catalogos";

export const metadata = metadataDaTela("/cadastros/catalogos");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDeCatalogosCarregando />}>
      <PaginaDeCatalogos searchParams={searchParams} />
    </Suspense>
  );
}
