import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/inicio/resumo-do-dia");

export default function Pagina() {
  return <TelaEmBreve rota="/inicio/resumo-do-dia" />;
}
