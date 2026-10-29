import { metadataDaTela, TelaEmBreve } from "@/components/navegacao/tela-em-breve";

export const metadata = metadataDaTela("/admin/usuarios-e-perfis");

export default function Pagina() {
  return <TelaEmBreve rota="/admin/usuarios-e-perfis" />;
}
