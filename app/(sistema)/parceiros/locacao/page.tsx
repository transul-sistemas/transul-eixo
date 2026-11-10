import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDaLocacao,
  PaginaDaLocacaoCarregando,
  type ParametrosDaBusca,
} from "./pagina-da-locacao";

export const metadata = metadataDaTela("/parceiros/locacao");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDaLocacaoCarregando />}>
      <PaginaDaLocacao searchParams={searchParams} />
    </Suspense>
  );
}
