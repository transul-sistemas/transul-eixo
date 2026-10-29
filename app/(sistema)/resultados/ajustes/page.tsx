import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/resultados/ajustes");

export default function Pagina() {
  return <TelaEmBreve rota="/resultados/ajustes" />;
}
