import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDoAbastecimento,
  PaginaDoAbastecimentoCarregando,
  type ParametrosDaBusca,
} from "./pagina-do-abastecimento";

export const metadata = metadataDaTela("/frota/abastecimento");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDoAbastecimentoCarregando />}>
      <PaginaDoAbastecimento searchParams={searchParams} />
    </Suspense>
  );
}
