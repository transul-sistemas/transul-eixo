import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/pessoas/status-diario");

export default function Pagina() {
  return <TelaEmBreve rota="/pessoas/status-diario" />;
}
