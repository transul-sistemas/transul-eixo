import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import { PaginaDaSaude, PaginaDaSaudeCarregando, type ParametrosDaBusca } from "./pagina-da-saude";

export const metadata = metadataDaTela("/cadastros/saude-do-cr");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDaSaudeCarregando />}>
      <PaginaDaSaude searchParams={searchParams} />
    </Suspense>
  );
}
