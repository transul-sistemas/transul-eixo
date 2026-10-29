import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/pessoas/documentos");

export default function Pagina() {
  return <TelaEmBreve rota="/pessoas/documentos" />;
}
