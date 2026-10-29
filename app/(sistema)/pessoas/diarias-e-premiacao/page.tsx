import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/pessoas/diarias-e-premiacao");

export default function Pagina() {
  return <TelaEmBreve rota="/pessoas/diarias-e-premiacao" />;
}
