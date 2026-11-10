import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import type { ParametrosDaBusca } from "../navegacao-da-lista";
import { PaginaDoPatio, PaginaDoPatioCarregando } from "./pagina-do-patio";

export const metadata = metadataDaTela("/operacional/patio");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDoPatioCarregando />}>
      <PaginaDoPatio searchParams={searchParams} />
    </Suspense>
  );
}
