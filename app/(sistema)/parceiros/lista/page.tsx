import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDeParceiros,
  PaginaDeParceirosCarregando,
  type ParametrosDaBusca,
} from "./pagina-de-parceiros";

export const metadata = metadataDaTela("/parceiros/lista");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDeParceirosCarregando />}>
      <PaginaDeParceiros searchParams={searchParams} />
    </Suspense>
  );
}
