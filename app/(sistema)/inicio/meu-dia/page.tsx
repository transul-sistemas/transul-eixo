import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import { PaginaDoMeuDia, PaginaDoMeuDiaCarregando } from "./pagina-do-meu-dia";

export const metadata = metadataDaTela("/inicio/meu-dia");

// A página é síncrona; quem lê a sessão e o banco fica dentro do Suspense (lib/qualidade/leitura-em-suspense).
export default function Pagina() {
  return (
    <Suspense fallback={<PaginaDoMeuDiaCarregando />}>
      <PaginaDoMeuDia />
    </Suspense>
  );
}
