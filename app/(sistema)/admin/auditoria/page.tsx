import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/admin/auditoria");

export default function Pagina() {
  return <TelaEmBreve rota="/admin/auditoria" />;
}
