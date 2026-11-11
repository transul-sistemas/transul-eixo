import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import { lerFiltroDoMapa } from "@/lib/navegacao/mapa-do-sistema";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { PaginaDoMapa } from "./pagina-do-mapa";

export const metadata = metadataDaTela("/inicio/mapa-do-sistema");

type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

async function MapaDaSessao({ searchParams }: { searchParams: ParametrosDaBusca }) {
  const [{ perfil }, busca] = await Promise.all([exigirSessao(), searchParams]);
  const estado = Array.isArray(busca.estado) ? busca.estado[0] : busca.estado;
  return <PaginaDoMapa perfil={perfil} filtro={lerFiltroDoMapa(estado)} />;
}

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={null}>
      <MapaDaSessao searchParams={searchParams} />
    </Suspense>
  );
}
