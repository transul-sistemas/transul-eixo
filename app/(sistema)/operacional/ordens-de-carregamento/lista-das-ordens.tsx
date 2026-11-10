"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Etiqueta } from "@/components/etiqueta";
import { formatarData, formatarDataEHora } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { Placa } from "@/components/placa";
import { Button } from "@/components/ui/button";
import type {
  OperacaoAEscolher,
  OrdemDeCarregamento,
  PlacaDoPatio,
  SituacaoDaOrdem,
} from "@/lib/dados/operacional-tipos";
import type { Status } from "@/lib/visual/tons";
import { CriarOrdem } from "./criar-ordem";

// A lista das ordens de carregamento (as mais novas primeiro) e o botão "Criar ordem", que abre o
// assistente com as placas aceitas no pátio.

export const NOMES_DAS_SITUACOES: Record<SituacaoDaOrdem, string> = {
  carregando: "Carregando",
  carregada: "Carregada",
  em_viagem: "Em viagem",
};

const TOM: Record<SituacaoDaOrdem, Status> = {
  carregando: "atencao",
  carregada: "patio",
  em_viagem: "em-atividade",
};

export function ListaDasOrdens({
  ordens,
  aguardando,
  operacoes,
  hoje,
}: {
  ordens: OrdemDeCarregamento[];
  aguardando: PlacaDoPatio[];
  operacoes: OperacaoAEscolher[];
  hoje: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const quemAbriu = useRef<HTMLElement | null>(null);

  return (
    <>
      <div className="flex justify-end">
        <Button
          onClick={(evento) => {
            quemAbriu.current = evento.currentTarget;
            setAberto(true);
          }}
        >
          Criar ordem
        </Button>
      </div>
      {ordens.length > 0 ? (
        <div className="border-border bg-card relative overflow-x-auto rounded-xl border">
          <table className="w-full text-sm" data-testid="tabela-das-ordens">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th scope="col" className="bg-muted sticky left-0 px-3 py-2 text-left font-medium">
                  Ordem
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Placa
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Situação
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Operação
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Destino
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Saída prevista
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Filial
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Criada em
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Carregada em
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Saiu em
                </th>
              </tr>
            </thead>
            <tbody>
              {ordens.map((o) => (
                <tr key={o.ordemId} className="border-border border-t">
                  <th
                    scope="row"
                    className="bg-card sticky left-0 px-3 py-2 text-left font-semibold tabular-nums"
                  >
                    nº {formatarInteiro(o.numero)}
                  </th>
                  <td className="px-3 py-2">
                    <Placa placa={o.placa} tamanho="p" />
                  </td>
                  <td className="px-3 py-2">
                    <Etiqueta status={TOM[o.situacao]}>{NOMES_DAS_SITUACOES[o.situacao]}</Etiqueta>
                  </td>
                  <td className="px-3 py-2">{o.operacao ?? "—"}</td>
                  <td className="px-3 py-2">{o.destino}</td>
                  <td className="px-3 py-2 tabular-nums">{formatarData(o.dataPrevista)}</td>
                  <td className="px-3 py-2">{o.filial}</td>
                  <td className="px-3 py-2 tabular-nums">{formatarDataEHora(o.criadaEm)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatarDataEHora(o.carregadaEm)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatarDataEHora(o.saiuEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {aberto ? (
        <CriarOrdem
          placas={aguardando}
          operacoes={operacoes}
          hoje={hoje}
          focoFinal={quemAbriu}
          aoGravar={() => router.refresh()}
          aoFechar={() => setAberto(false)}
        />
      ) : null}
    </>
  );
}
