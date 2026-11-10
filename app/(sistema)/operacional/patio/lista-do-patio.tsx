"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Etiqueta } from "@/components/etiqueta";
import { formatarData, formatarDataEHora } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { Placa } from "@/components/placa";
import { Button } from "@/components/ui/button";
import type { OperacaoAEscolher, PlacaDoPatio } from "@/lib/dados/operacional-tipos";
import { NOMES_DOS_TIPOS, type TipoDeAtivo } from "@/lib/dados/placas-tipos";
import {
  ACOES_DO_PATIO,
  type AcaoDeAvancar,
  type AcaoDoPatio,
  acoesPossiveis,
} from "@/lib/dominio/esquemas/operacional";
import { STATUS, type Status } from "@/lib/visual/tons";
import { CriarOrdem } from "../ordens-de-carregamento/criar-ordem";
import { AvancarPlaca } from "./avancar-placa";

// A lista do pátio: a fila primeiro (ordem de chegada), depois as demais placas sob custódia da filial.
// Cada linha oferece só as ações que a situação permite; cada ação abre o seu assistente.

type Aberto = { placa: PlacaDoPatio; acao: AcaoDoPatio } | null;

export function ListaDoPatio({
  linhas,
  aguardando,
  operacoes,
  hoje,
}: {
  linhas: PlacaDoPatio[];
  /** As placas em ACe, para o assistente "Criar ordem". */
  aguardando: PlacaDoPatio[];
  operacoes: OperacaoAEscolher[];
  hoje: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState<Aberto>(null);
  const quemAbriu = useRef<HTMLElement | null>(null);
  const fechar = () => setAberto(null);
  const gravou = () => router.refresh();

  return (
    <>
      <div className="border-border bg-card overflow-x-auto rounded-xl border">
        <table className="w-full text-sm" data-testid="tabela-do-patio">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th scope="col" className="bg-muted sticky left-0 px-3 py-2 text-left font-medium">
                Placa
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Fila
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Situação
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Tipo
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Implementos
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Filial
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                No pátio desde
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Chegou
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Ordem
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.ativoId} className="border-border border-t">
                <th scope="row" className="bg-card sticky left-0 px-3 py-2 text-left font-normal">
                  <Placa placa={l.placa} tamanho="p" />
                </th>
                <td className="px-3 py-2 text-right tabular-nums">
                  {l.posicao ? `${formatarInteiro(l.posicao)}º` : "—"}
                </td>
                <td className="px-3 py-2">
                  {l.grupo && (STATUS as readonly string[]).includes(l.grupo) ? (
                    <Etiqueta status={l.grupo as Status} titulo={l.nomeDaSituacao ?? undefined}>
                      {l.sigla}
                    </Etiqueta>
                  ) : (
                    l.sigla
                  )}
                </td>
                <td className="px-3 py-2">{NOMES_DOS_TIPOS[l.tipo as TipoDeAtivo] ?? l.tipo}</td>
                <td className="px-3 py-2">{l.implementos.join(", ") || "—"}</td>
                <td className="px-3 py-2">{l.filial}</td>
                <td className="px-3 py-2 tabular-nums">{formatarDataEHora(l.desde)}</td>
                <td className="px-3 py-2 tabular-nums">{formatarDataEHora(l.chegouEm)}</td>
                <td className="px-3 py-2">
                  {l.ordemNumero ? (
                    <span title={l.ordemOperacao ?? undefined}>
                      nº {formatarInteiro(l.ordemNumero)} · {l.ordemDestino}
                      {l.ordemData ? ` · ${formatarData(l.ordemData)}` : ""}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    {acoesPossiveis(l.sigla).map((acao) => (
                      <Button
                        key={acao}
                        variant={acao === "devolver" ? "outline" : "default"}
                        size="sm"
                        aria-label={`${ACOES_DO_PATIO[acao].botao}: ${l.placa}`}
                        onClick={(evento) => {
                          quemAbriu.current = evento.currentTarget;
                          setAberto({ placa: l, acao });
                        }}
                      >
                        {ACOES_DO_PATIO[acao].botao}
                      </Button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {aberto && aberto.acao === "criar-ordem" ? (
        <CriarOrdem
          placas={
            aguardando.some((p) => p.ativoId === aberto.placa.ativoId) ? aguardando : [aberto.placa]
          }
          placaInicial={aberto.placa.ativoId}
          operacoes={operacoes}
          hoje={hoje}
          focoFinal={quemAbriu}
          aoGravar={gravou}
          aoFechar={fechar}
        />
      ) : aberto ? (
        <AvancarPlaca
          placa={aberto.placa}
          acao={aberto.acao as AcaoDeAvancar}
          focoFinal={quemAbriu}
          aoGravar={gravou}
          aoFechar={fechar}
        />
      ) : null}
    </>
  );
}
