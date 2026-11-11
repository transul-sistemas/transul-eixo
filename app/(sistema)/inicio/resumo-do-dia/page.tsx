import { TelaDeEsqueleto } from "@/components/esqueleto/tela-de-esqueleto";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/inicio/resumo-do-dia");

export default function Pagina() {
  return <TelaDeEsqueleto rota="/inicio/resumo-do-dia" />;
}
