import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/inicio/tarefas");

export default function Pagina() {
  return <TelaEmBreve rota="/inicio/tarefas" />;
}
