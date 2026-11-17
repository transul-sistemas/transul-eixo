import { Suspense } from "react";
import { metadataDaTela } from "@/components/navegacao/tela-em-breve";
import {
  type ParametrosDaBusca,
  TelaDePainel,
  TelaDePainelCarregando,
} from "@/components/paineis/tela-de-painel";

const ROTA = "/admin/painel-de-processos";

export const metadata = metadataDaTela(ROTA);

export default function Pagina({ searchParams }: { searchParams: ParametrosDaBusca }) {
  return (
    <Suspense fallback={<TelaDePainelCarregando rota={ROTA} />}>
      <TelaDePainel
        id="admin.painel-de-processos"
        rota={ROTA}
        searchParams={searchParams}
        assistentes={["reatribuir-tarefa", "delegar-tarefas"]}
      />
    </Suspense>
  );
}
