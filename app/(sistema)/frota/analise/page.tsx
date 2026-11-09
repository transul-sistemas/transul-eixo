import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDaAnalise,
  PaginaDaAnaliseCarregando,
  type ParametrosDaBusca,
} from "./pagina-da-analise";

export const metadata = metadataDaTela("/frota/analise");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDaAnaliseCarregando />}>
      <PaginaDaAnalise searchParams={searchParams} />
    </Suspense>
  );
}
