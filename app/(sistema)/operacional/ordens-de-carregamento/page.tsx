import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/operacional/ordens-de-carregamento");

export default function Pagina() {
  return <TelaEmBreve rota="/operacional/ordens-de-carregamento" />;
}
