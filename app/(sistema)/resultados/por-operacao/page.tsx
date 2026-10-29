import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/resultados/por-operacao");

export default function Pagina() {
  return <TelaEmBreve rota="/resultados/por-operacao" />;
}
