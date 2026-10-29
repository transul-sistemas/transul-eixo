import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/frota/acompanhamento");

export default function Pagina() {
  return <TelaEmBreve rota="/frota/acompanhamento" />;
}
