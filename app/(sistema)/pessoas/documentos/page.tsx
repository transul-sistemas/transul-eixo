import { TelaDeEsqueleto } from "@/components/esqueleto/tela-de-esqueleto";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/pessoas/documentos");

export default function Pagina() {
  return <TelaDeEsqueleto rota="/pessoas/documentos" />;
}
