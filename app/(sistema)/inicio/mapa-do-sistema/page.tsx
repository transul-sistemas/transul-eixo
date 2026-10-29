import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/inicio/mapa-do-sistema");

export default function Pagina() {
  return <TelaEmBreve rota="/inicio/mapa-do-sistema" />;
}
