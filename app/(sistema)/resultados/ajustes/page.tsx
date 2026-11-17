import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  type ParametrosDaBusca,
  TelaDePainel,
  TelaDePainelCarregando,
} from "@/components/paineis/tela-de-painel";

const ROTA = "/resultados/ajustes";

export const metadata = metadataDaTela(ROTA);

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<TelaDePainelCarregando rota={ROTA} />}>
      <TelaDePainel
        id="resultados.ajustes"
        rota={ROTA}
        searchParams={searchParams}
        assistentes={["pedir-ajuste", "decidir-ajuste"]}
      />
    </Suspense>
  );
}
