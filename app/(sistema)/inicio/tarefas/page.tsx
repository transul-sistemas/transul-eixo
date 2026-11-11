import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import { PaginaDasTarefas, PaginaDasTarefasCarregando } from "./pagina-das-tarefas";

export const metadata = metadataDaTela("/inicio/tarefas");

export default function Pagina() {
  return (
    <Suspense fallback={<PaginaDasTarefasCarregando />}>
      <PaginaDasTarefas />
    </Suspense>
  );
}
