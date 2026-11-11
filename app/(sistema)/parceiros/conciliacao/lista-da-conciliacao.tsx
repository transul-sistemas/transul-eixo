"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Etiqueta } from "@/components/etiqueta";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro } from "@/components/formato/numero";
import { Placa } from "@/components/placa";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import { Button } from "@/components/ui/button";
import {
  type LinhaDaConciliacao,
  NOMES_DAS_SITUACOES_DA_CONCILIACAO,
  type SituacaoDaConciliacao,
} from "@/lib/dados/parceiros-tipos";
import { enderecoDaFichaDoParceiro } from "@/lib/navegacao/parceiros";
import type { Status } from "@/lib/visual/tons";
import { JustificarDiferenca } from "./justificar-diferenca";

// As linhas da conciliação do mês (diferenças primeiro), cada uma com o que o Eixo espera (placas e
// dias), o que o Sankhya lançou e a situação. A linha com diferença ou sem lançamento tem o botão
// "Justificar diferença".

const TOM: Record<SituacaoDaConciliacao, Status> = {
  confere: "em-atividade",
  diferenca: "impedida",
  sem_lancamento: "atencao",
  justificada: "patio",
};

const TH = "px-3 py-2 text-left font-medium";
const THD = "px-3 py-2 text-right font-medium";

export function ListaDaConciliacao({
  linhas,
  mes,
  podeJustificar,
}: {
  linhas: LinhaDaConciliacao[];
  mes: string;
  podeJustificar: boolean;
}) {
  const router = useRouter();
  const [aberta, setAberta] = useState<LinhaDaConciliacao | null>(null);
  const quemAbriu = useRef<HTMLElement | null>(null);
  return (
    <>
      <div className="border-border bg-card relative overflow-x-auto rounded-xl border">
        <table className="w-full text-sm" aria-label="Conciliação do mês">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th scope="col" className={`bg-muted sticky left-0 ${TH}`}>
                CR
              </th>
              <th scope="col" className={TH}>
                Parceiro
              </th>
              <th scope="col" className={TH}>
                Placas esperadas
              </th>
              <th scope="col" className={THD}>
                Dias
              </th>
              <th scope="col" className={THD}>
                Despesa
              </th>
              <th scope="col" className={THD}>
                Receita
              </th>
              <th scope="col" className={THD}>
                Lançamentos
              </th>
              <th scope="col" className={THD}>
                Com outra placa
              </th>
              <th scope="col" className={TH}>
                Situação
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">Ações</span>
              </th>
              <th scope="col" className={`${THD} w-14`}>
                Detalhes
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.crId} className="border-border border-t align-top">
                <th scope="row" className="bg-card sticky left-0 px-3 py-2 text-left font-normal">
                  <span className="font-semibold tabular-nums">{l.crCodigo}</span>
                  {l.crNome ? (
                    <span className="text-muted-foreground block text-xs">{l.crNome}</span>
                  ) : null}
                </th>
                <td className="px-3 py-2">
                  {l.parceiroNome ?? l.agrupadorNome ?? l.agrupadorCodigo}
                  {l.parceiroId ? null : (
                    <span className="text-muted-foreground block text-xs">
                      sem parceiro cadastrado
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {l.placas.length === 0 ? (
                    <span className="text-muted-foreground">nenhuma</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {l.placas.map((p) => (
                        <Link
                          key={p}
                          href={`/frota/placas/${p}`}
                          aria-label={`Abrir a ficha da placa ${p}`}
                          className="focus-visible:ring-ring/50 inline-flex rounded outline-none focus-visible:ring-3"
                        >
                          <Placa placa={p} tamanho="p" />
                        </Link>
                      ))}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatarInteiro(l.dias)}</td>
                <td className="px-3 py-2">
                  <Moeda valor={l.despesaCentavos} />
                </td>
                <td className="px-3 py-2">
                  <Moeda valor={l.receitaCentavos} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatarInteiro(l.lancamentos)}
                </td>
                <td className="px-3 py-2">
                  <Moeda valor={l.foraDaPlacaCentavos} />
                </td>
                <td className="px-3 py-2">
                  <Etiqueta status={TOM[l.situacao]}>
                    {NOMES_DAS_SITUACOES_DA_CONCILIACAO[l.situacao]}
                  </Etiqueta>
                  {l.motivo ? (
                    <span className="text-muted-foreground mt-1 block max-w-[32ch] text-xs">
                      {l.motivo}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {podeJustificar &&
                  (l.situacao === "diferenca" || l.situacao === "sem_lancamento") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-haspopup="dialog"
                      aria-label={`Justificar diferença do CR ${l.crCodigo}`}
                      onClick={(evento) => {
                        quemAbriu.current = evento.currentTarget;
                        setAberta(l);
                      }}
                    >
                      Justificar diferença
                    </Button>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">
                  <BotaoDoOlho
                    item={`CR ${l.crCodigo}`}
                    hrefDaFicha={
                      l.parceiroId ? enderecoDaFichaDoParceiro(l.parceiroId, mes) : undefined
                    }
                    detalhes={[
                      {
                        rotulo: "Parceiro",
                        valor: l.parceiroNome ?? l.agrupadorNome ?? l.agrupadorCodigo,
                      },
                      { rotulo: "Placas esperadas", valor: formatarInteiro(l.placas.length) },
                      { rotulo: "Dias", valor: formatarInteiro(l.dias) },
                      { rotulo: "Despesa", valor: <Moeda valor={l.despesaCentavos} /> },
                      { rotulo: "Receita", valor: <Moeda valor={l.receitaCentavos} /> },
                      { rotulo: "Lançamentos", valor: formatarInteiro(l.lancamentos) },
                      { rotulo: "Com outra placa", valor: <Moeda valor={l.foraDaPlacaCentavos} /> },
                      { rotulo: "Situação", valor: NOMES_DAS_SITUACOES_DA_CONCILIACAO[l.situacao] },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {aberta ? (
        <JustificarDiferenca
          key={aberta.crId}
          linha={aberta}
          mes={mes}
          focoFinal={quemAbriu}
          aoGravar={() => router.refresh()}
          aoFechar={() => setAberta(null)}
        />
      ) : null}
    </>
  );
}
