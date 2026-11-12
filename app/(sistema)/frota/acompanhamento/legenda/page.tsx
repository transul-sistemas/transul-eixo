import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LegendaDaRegua } from "@/components/legenda/legenda-da-regua";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { montarLegenda } from "@/lib/dominio/legenda";

export const metadata: Metadata = { title: "Legenda e siglas · TranSul Eixo" };

type Busca = Promise<Record<string, string | string[] | undefined>>;

/** Lê a busca da URL (`?busca=`): fica dentro de um Suspense, porque `searchParams` é dado de requisição. */
async function LegendaComBusca({ searchParams }: { searchParams: Busca }) {
  const bruto = (await searchParams).busca;
  const busca = (Array.isArray(bruto) ? bruto[0] : bruto) ?? "";
  return <LegendaDaRegua legenda={montarLegenda()} buscaInicial={busca.slice(0, 80)} />;
}

/**
 * Legenda e siglas: gerada da régua de status (`lib/dominio/status.ts`), nunca digitada. A busca fica na
 * URL (`?busca=`). Rota filha do Acompanhamento; a trilha e o botão "Legenda" da grade levam até ela.
 */
export default function Pagina({ searchParams }: { searchParams: Busca }) {
  return (
    <PaginaDeLeitura
      titulo="Legenda e siglas"
      descricao="O que significa cada sigla e cada cor que aparece na grade do Acompanhamento."
      acoes={
        <Link
          href="/frota/acompanhamento"
          className="border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm outline-none focus-visible:ring-3 print:hidden"
        >
          Voltar ao Acompanhamento
        </Link>
      }
    >
      <Suspense fallback={<LegendaDaRegua legenda={montarLegenda()} buscaInicial="" />}>
        <LegendaComBusca searchParams={searchParams} />
      </Suspense>
    </PaginaDeLeitura>
  );
}
