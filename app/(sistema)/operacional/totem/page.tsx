import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/operacional/totem");

export default function Pagina() {
  return <TelaEmBreve rota="/operacional/totem" />;
}
