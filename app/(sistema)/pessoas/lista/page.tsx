import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDePessoas,
  PaginaDePessoasCarregando,
  type ParametrosDaBusca,
} from "./pagina-de-pessoas";

export const metadata = metadataDaTela("/pessoas/lista");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDePessoasCarregando />}>
      <PaginaDePessoas searchParams={searchParams} />
    </Suspense>
  );
}
