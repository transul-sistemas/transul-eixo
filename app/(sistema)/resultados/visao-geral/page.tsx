import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDaVisaoGeral,
  PaginaDaVisaoGeralCarregando,
  type ParametrosDaBusca,
} from "./pagina-da-visao-geral";

export const metadata = metadataDaTela("/resultados/visao-geral");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDaVisaoGeralCarregando />}>
      <PaginaDaVisaoGeral searchParams={searchParams} />
    </Suspense>
  );
}
