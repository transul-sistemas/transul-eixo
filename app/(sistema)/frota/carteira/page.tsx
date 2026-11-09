import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDaCarteira,
  PaginaDaCarteiraCarregando,
  type ParametrosDaBusca,
} from "./pagina-da-carteira";

export const metadata = metadataDaTela("/frota/carteira");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDaCarteiraCarregando />}>
      <PaginaDaCarteira searchParams={searchParams} />
    </Suspense>
  );
}
