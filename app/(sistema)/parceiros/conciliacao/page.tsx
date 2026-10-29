import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/parceiros/conciliacao");

export default function Pagina() {
  return <TelaEmBreve rota="/parceiros/conciliacao" />;
}
