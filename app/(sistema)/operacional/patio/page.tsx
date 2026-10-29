import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/operacional/patio");

export default function Pagina() {
  return <TelaEmBreve rota="/operacional/patio" />;
}
