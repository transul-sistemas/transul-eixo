import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  PaginaDeUsuarios,
  PaginaDeUsuariosCarregando,
  type ParametrosDaBusca,
} from "./pagina-de-usuarios";

export const metadata = metadataDaTela("/admin/usuarios-e-perfis");

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<PaginaDeUsuariosCarregando />}>
      <PaginaDeUsuarios searchParams={searchParams} />
    </Suspense>
  );
}
