import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/operacoes/lista");

export default function Pagina() {
  return <TelaEmBreve rota="/operacoes/lista" />;
}
