import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDoAcompanhamento,
  PaginaDoAcompanhamentoCarregando,
  type ParametrosDaBusca,
} from "./pagina-do-acompanhamento";

export const metadata = metadataDaTela("/frota/acompanhamento");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDoAcompanhamentoCarregando />}>
      <PaginaDoAcompanhamento searchParams={searchParams} />
    </Suspense>
  );
}
