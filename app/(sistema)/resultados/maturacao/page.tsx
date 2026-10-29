import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/resultados/maturacao");

export default function Pagina() {
  return <TelaEmBreve rota="/resultados/maturacao" />;
}
