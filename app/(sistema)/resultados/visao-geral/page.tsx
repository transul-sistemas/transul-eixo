import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/resultados/visao-geral");

export default function Pagina() {
  return <TelaEmBreve rota="/resultados/visao-geral" />;
}
