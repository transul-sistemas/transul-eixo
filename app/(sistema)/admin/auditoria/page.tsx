import { TelaDeEsqueleto } from "@/components/esqueleto/tela-de-esqueleto";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/admin/auditoria");

export default function Pagina() {
  return <TelaDeEsqueleto rota="/admin/auditoria" />;
}
