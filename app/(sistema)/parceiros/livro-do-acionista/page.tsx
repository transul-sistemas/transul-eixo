import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/parceiros/livro-do-acionista");

export default function Pagina() {
  return <TelaEmBreve rota="/parceiros/livro-do-acionista" />;
}
