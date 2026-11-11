import { TelaDeEsqueleto } from "@/components/esqueleto/tela-de-esqueleto";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/inicio/tarefas");

export default function Pagina() {
  return <TelaDeEsqueleto rota="/inicio/tarefas" />;
}
