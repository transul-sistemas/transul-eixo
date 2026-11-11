"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Etiqueta } from "@/components/etiqueta";
import { formatarData } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import { Placa } from "@/components/placa";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import { Button } from "@/components/ui/button";
import type { Locacao, Locacoes, SituacaoDaLocacao } from "@/lib/dados/parceiros-tipos";
import type { Status } from "@/lib/visual/tons";
import { CadastrarLocacao, EncerrarLocacao } from "./assistentes-da-locacao";

// A lista dos contratos de locação (vigentes primeiro), com o botão "Cadastrar locação" e, em cada
// contrato vigente ou futuro, "Encerrar locação".

const NOMES: Record<SituacaoDaLocacao, string> = {
  vigente: "Vigente",
  futura: "Futura",
  encerrada: "Encerrada",
};
const TOM: Record<SituacaoDaLocacao, Status> = {
  vigente: "em-atividade",
  futura: "patio",
  encerrada: "fora",
};
const TH = "px-3 py-2 text-left font-medium";

export function ListaDasLocacoes({
  dados,
  podeCadastrar,
  podeEncerrar,
}: {
  dados: Locacoes;
  podeCadastrar: boolean;
  podeEncerrar: boolean;
}) {
  const router = useRouter();
  const [cadastrando, setCadastrando] = useState(false);
  const [encerrando, setEncerrando] = useState<Locacao | null>(null);
  const quemAbriu = useRef<HTMLElement | null>(null);
  return (
    <>
      {podeCadastrar ? (
        <div className="flex justify-end">
          <Button
            aria-haspopup="dialog"
            onClick={(evento) => {
              quemAbriu.current = evento.currentTarget;
              setCadastrando(true);
            }}
          >
            Cadastrar locação
          </Button>
        </div>
      ) : null}
      {dados.linhas.length > 0 ? (
        <div className="border-border bg-card relative overflow-x-auto rounded-xl border">
          <table className="w-full text-sm" aria-label="Contratos de locação">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th scope="col" className={`bg-muted sticky left-0 ${TH}`}>
                  Placa
                </th>
                <th scope="col" className={TH}>
                  Parceiro
                </th>
                <th scope="col" className={TH}>
                  Início
                </th>
                <th scope="col" className={TH}>
                  Fim
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Valor mensal
                </th>
                <th scope="col" className={TH}>
                  Situação
                </th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Ações</span>
                </th>
                <th scope="col" className={`${TH} w-14 text-right`}>
                  Detalhes
                </th>
              </tr>
            </thead>
            <tbody>
              {dados.linhas.map((l) => (
                <tr key={l.id} className="border-border border-t align-top">
                  <th scope="row" className="bg-card sticky left-0 px-3 py-2 text-left font-normal">
                    <Link
                      href={`/frota/placas/${l.placa}`}
                      aria-label={`Abrir a ficha da placa ${l.placa}`}
                      className="focus-visible:ring-ring/50 inline-flex rounded outline-none focus-visible:ring-3"
                    >
                      <Placa placa={l.placa} tamanho="p" />
                    </Link>
                  </th>
                  <td className="px-3 py-2">{l.parceiroNome}</td>
                  <td className="px-3 py-2 tabular-nums">{formatarData(l.inicio)}</td>
                  <td className="px-3 py-2 tabular-nums">{l.fim ? formatarData(l.fim) : "—"}</td>
                  <td className="px-3 py-2">
                    <Moeda valor={l.valorMensalCentavos} />
                  </td>
                  <td className="px-3 py-2">
                    <Etiqueta status={TOM[l.situacao]}>{NOMES[l.situacao]}</Etiqueta>
                    {l.motivoDoEncerramento ? (
                      <span className="text-muted-foreground mt-1 block max-w-[32ch] text-xs">
                        {l.motivoDoEncerramento}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {podeEncerrar && l.situacao !== "encerrada" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-haspopup="dialog"
                        aria-label={`Encerrar locação da placa ${l.placa}`}
                        onClick={(evento) => {
                          quemAbriu.current = evento.currentTarget;
                          setEncerrando(l);
                        }}
                      >
                        Encerrar locação
                      </Button>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <BotaoDoOlho
                      item={l.placa}
                      hrefDaFicha={`/frota/placas/${l.placa}`}
                      titulo={<Placa placa={l.placa} tamanho="m" />}
                      detalhes={[
                        { rotulo: "Parceiro", valor: l.parceiroNome },
                        { rotulo: "Início", valor: formatarData(l.inicio) },
                        { rotulo: "Fim", valor: l.fim ? formatarData(l.fim) : "—" },
                        { rotulo: "Valor mensal", valor: <Moeda valor={l.valorMensalCentavos} /> },
                        { rotulo: "Situação", valor: NOMES[l.situacao] },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {cadastrando ? (
        <CadastrarLocacao
          parceiros={dados.parceiros}
          hoje={dados.hoje}
          focoFinal={quemAbriu}
          aoGravar={() => router.refresh()}
          aoFechar={() => setCadastrando(false)}
        />
      ) : null}
      {encerrando ? (
        <EncerrarLocacao
          key={`${encerrando.id}-${encerrando.versao}`}
          locacao={encerrando}
          hoje={dados.hoje}
          focoFinal={quemAbriu}
          aoGravar={() => router.refresh()}
          aoFechar={() => setEncerrando(null)}
        />
      ) : null}
    </>
  );
}
