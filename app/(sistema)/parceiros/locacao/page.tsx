import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/parceiros/locacao");

export default function Pagina() {
  return <TelaEmBreve rota="/parceiros/locacao" />;
}
