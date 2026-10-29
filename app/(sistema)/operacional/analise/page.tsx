import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/operacional/analise");

export default function Pagina() {
  return <TelaEmBreve rota="/operacional/analise" />;
}
