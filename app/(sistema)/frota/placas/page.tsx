import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/frota/placas");

export default function Pagina() {
  return <TelaEmBreve rota="/frota/placas" />;
}
