import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/pessoas/analise");

export default function Pagina() {
  return <TelaEmBreve rota="/pessoas/analise" />;
}
