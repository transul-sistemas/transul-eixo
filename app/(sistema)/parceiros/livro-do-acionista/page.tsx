import { TelaDeEsqueleto } from "@/components/esqueleto/tela-de-esqueleto";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/parceiros/livro-do-acionista");

export default function Pagina() {
  return <TelaDeEsqueleto rota="/parceiros/livro-do-acionista" />;
}
