import { TelaDeEsqueleto } from "@/components/esqueleto/tela-de-esqueleto";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/resultados/ajustes");

export default function Pagina() {
  return <TelaDeEsqueleto rota="/resultados/ajustes" />;
}
