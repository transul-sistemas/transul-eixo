import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/cadastros/catalogos");

export default function Pagina() {
  return <TelaEmBreve rota="/cadastros/catalogos" />;
}
