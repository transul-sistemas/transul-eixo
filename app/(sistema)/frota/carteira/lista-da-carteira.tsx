"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Etiqueta } from "@/components/etiqueta";
import { formatarDataEHora } from "@/components/formato/data";
import { Placa } from "@/components/placa";
import { Button } from "@/components/ui/button";
import type { CarteiraDoMes, PlacaDaCarteira } from "@/lib/dados/acompanhamento-tipos";
import { NOMES_DOS_TIPOS } from "@/lib/dados/placas-tipos";
import { STATUS, type Status } from "@/lib/visual/tons";
import { ConfirmarCarteira } from "./confirmar-carteira";

// A lista da carteira do mês: cada placa com a situação de agora e a resposta do gestor. "Confirmar
// pendentes" abre o assistente com as pendentes da página; "Confirmar" na linha, só com aquela placa.

function Resposta({ placa }: { placa: PlacaDaCarteira }) {
  if (placa.confere === null) return <span className="text-muted-foreground">Pendente</span>;
  return placa.confere ? (
    <Etiqueta status="em-atividade">Confere</Etiqueta>
  ) : (
    <Etiqueta status="impedida">Não confere</Etiqueta>
  );
}

export function ListaDaCarteira({ carteira }: { carteira: CarteiraDoMes }) {
  const router = useRouter();
  const [escolhidas, setEscolhidas] = useState<PlacaDaCarteira[] | null>(null);
  const quemAbriu = useRef<HTMLElement | null>(null);
  const pendentes = carteira.linhas.filter((l) => l.confere === null);
  const mes = carteira.mes.slice(0, 7);

  return (
    <>
      <div className="flex justify-end">
        <Button
          disabled={pendentes.length === 0}
          onClick={(evento) => {
            quemAbriu.current = evento.currentTarget;
            setEscolhidas(pendentes);
          }}
        >
          Confirmar pendentes
        </Button>
      </div>
      <div className="border-border bg-card relative overflow-x-auto rounded-xl border">
        <table className="w-full text-sm" data-testid="tabela-da-carteira">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th scope="col" className="bg-muted sticky left-0 px-3 py-2 text-left font-medium">
                Placa
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Tipo
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Modelo
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Situação agora
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Resposta
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Observação
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Confirmada em
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {carteira.linhas.map((l) => (
              <tr key={l.ativoId} className="border-border border-t">
                <th scope="row" className="bg-card sticky left-0 px-3 py-2 text-left font-normal">
                  <Placa placa={l.placa} tamanho="p" />
                </th>
                <td className="px-3 py-2">{NOMES_DOS_TIPOS[l.tipo] ?? l.tipo}</td>
                <td className="px-3 py-2">{l.modelo}</td>
                <td className="px-3 py-2">
                  {l.grupo && (STATUS as readonly string[]).includes(l.grupo) ? (
                    <Etiqueta status={l.grupo as Status} titulo={l.nomeDaSituacao ?? undefined}>
                      {l.sigla}
                    </Etiqueta>
                  ) : (
                    l.sigla
                  )}
                </td>
                <td className="px-3 py-2">
                  <Resposta placa={l} />
                </td>
                <td
                  className="text-muted-foreground max-w-64 truncate px-3 py-2"
                  title={l.observacao ?? undefined}
                >
                  {l.observacao ?? "—"}
                </td>
                <td className="px-3 py-2 tabular-nums">{formatarDataEHora(l.confirmadoEm)}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Confirmar ${l.placa}`}
                    onClick={(evento) => {
                      quemAbriu.current = evento.currentTarget;
                      setEscolhidas([l]);
                    }}
                  >
                    Confirmar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {escolhidas ? (
        <ConfirmarCarteira
          mes={mes}
          placas={escolhidas}
          focoFinal={quemAbriu}
          aoGravar={() => router.refresh()}
          aoFechar={() => setEscolhidas(null)}
        />
      ) : null}
    </>
  );
}
