import { TelaDeEsqueleto } from "@/components/esqueleto/tela-de-esqueleto";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/pessoas/analise");

export default function Pagina() {
  return <TelaDeEsqueleto rota="/pessoas/analise" />;
}
