import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDaFila,
  PaginaDaFilaCarregando,
  type ParametrosDaBusca,
} from "./pagina-da-fila";

export const metadata = metadataDaTela("/frota/excecoes");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDaFilaCarregando />}>
      <PaginaDaFila searchParams={searchParams} />
    </Suspense>
  );
}
