"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, useRef, useState } from "react";
import { formatarData } from "@/components/formato/data";
import { Placa } from "@/components/placa";
import type { GradeDoMes as Grade, LinhaDaGrade } from "@/lib/dados/acompanhamento-tipos";
import { STATUS, type Status, variavelDoStatus } from "@/lib/visual/tons";
import { LancarSituacao } from "./lancar-situacao";

// A grade do mês: uma linha por placa, uma coluna por dia. Cada célula mostra a situação no fim do dia
// (a cor é a do grupo de status) e abre o assistente "Lançar situação" daquele dia. Dia futuro não
// abre nada. Cabeçalho e primeira coluna fixos; a rolagem lateral fica só dentro da tabela.

function tomDaCelula(grupo: string | null): CSSProperties | undefined {
  if (grupo === null || !(STATUS as readonly string[]).includes(grupo)) return undefined;
  const forte = variavelDoStatus(grupo as Status);
  return { backgroundColor: `var(${forte}-suave)`, boxShadow: `inset 0 -2px 0 var(${forte})` };
}

export function GradeDoMes({ grade }: { grade: Grade }) {
  const router = useRouter();
  const [aberta, setAberta] = useState<{ linha: LinhaDaGrade; dia: string } | null>(null);
  const quemAbriu = useRef<HTMLElement | null>(null);
  const dias = grade.linhas[0]?.dias.map((d) => d.dia) ?? [];

  return (
    <>
      <div
        className="border-border bg-card max-h-[max(24rem,calc(100dvh-9rem))] overflow-auto rounded-xl border"
        data-testid="grade-do-mes"
      >
        <table className="border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th
                scope="col"
                className="bg-card border-border sticky top-0 left-0 z-20 border-b px-3 py-2 text-left text-sm font-medium"
              >
                Placa
              </th>
              {dias.map((dia) => (
                <th
                  key={dia}
                  scope="col"
                  className={
                    "bg-card border-border text-muted-foreground sticky top-0 z-10 min-w-11 border-b px-1 py-2 text-center font-medium tabular-nums" +
                    (dia === grade.hoje ? " text-foreground" : "")
                  }
                  aria-label={formatarData(dia)}
                >
                  {dia.slice(8)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grade.linhas.map((linha) => (
              <tr key={linha.ativoId}>
                <th
                  scope="row"
                  className="bg-card border-border sticky left-0 z-10 border-b px-3 py-1.5 text-left font-normal"
                >
                  <span className="flex items-center gap-2">
                    <Placa placa={linha.placa} tamanho="p" />
                    <span className="text-muted-foreground max-w-40 truncate">{linha.modelo}</span>
                  </span>
                </th>
                {linha.dias.map((celula) => {
                  const futuro = celula.dia > grade.hoje;
                  const rotulo = `${linha.placa}, ${formatarData(celula.dia)}: ${celula.sigla ?? "sem situação"}`;
                  return (
                    <td key={celula.dia} className="border-border border-b p-0.5 text-center">
                      {futuro ? (
                        <span aria-hidden className="block h-7" />
                      ) : (
                        <button
                          type="button"
                          aria-label={`Lançar situação: ${rotulo}`}
                          title={rotulo}
                          style={tomDaCelula(celula.grupo)}
                          className="hover:ring-ring focus-visible:ring-ring/60 relative block h-7 w-full rounded font-medium outline-none hover:ring-1 focus-visible:ring-2"
                          onClick={(evento) => {
                            quemAbriu.current = evento.currentTarget;
                            setAberta({ linha, dia: celula.dia });
                          }}
                        >
                          {celula.sigla ?? "—"}
                          {celula.lancado ? (
                            <span
                              aria-hidden
                              className="bg-foreground/60 absolute top-0.5 right-0.5 size-1 rounded-full"
                            />
                          ) : null}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">
        Cada célula mostra a situação no fim do dia (hoje, a de agora). O ponto no canto marca o dia
        com lançamento. Clique numa célula para lançar a situação daquele dia.
      </p>
      {aberta ? (
        <LancarSituacao
          linha={aberta.linha}
          dia={aberta.dia}
          focoFinal={quemAbriu}
          aoGravar={() => router.refresh()}
          aoFechar={() => setAberta(null)}
        />
      ) : null}
    </>
  );
}
