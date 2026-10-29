import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/frota/abastecimento");

export default function Pagina() {
  return <TelaEmBreve rota="/frota/abastecimento" />;
}
