import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDaConciliacao,
  PaginaDaConciliacaoCarregando,
  type ParametrosDaBusca,
} from "./pagina-da-conciliacao";

export const metadata = metadataDaTela("/parceiros/conciliacao");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDaConciliacaoCarregando />}>
      <PaginaDaConciliacao searchParams={searchParams} />
    </Suspense>
  );
}
