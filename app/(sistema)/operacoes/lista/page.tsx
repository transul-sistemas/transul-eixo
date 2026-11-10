import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDeOperacoes,
  PaginaDeOperacoesCarregando,
  type ParametrosDaBusca,
} from "./pagina-de-operacoes";

export const metadata = metadataDaTela("/operacoes/lista");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDeOperacoesCarregando />}>
      <PaginaDeOperacoes searchParams={searchParams} />
    </Suspense>
  );
}
