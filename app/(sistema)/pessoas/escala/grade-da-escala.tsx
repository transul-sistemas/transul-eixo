"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatarData } from "@/components/formato/data";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import type { EscalaDoMes, PessoaDaEscala } from "@/lib/dados/pessoas-tipos";
import { SIGLAS_DA_ESCALA, type SiglaDaEscala } from "@/lib/dominio/esquemas/pessoa";
import { cn } from "@/lib/utils";
import { MarcarDia } from "./marcar-dia";

// A grade da escala: uma linha por pessoa vinculada à operação no mês, uma coluna por dia. A célula
// mostra a marcação (T, F, FE, AT) e abre o mini-assistente "Marcar dia". Dia fora do vínculo não
// abre nada. Cabeçalho e primeira coluna fixos; a rolagem lateral fica só dentro da grade.

const NOMES = Object.fromEntries(SIGLAS_DA_ESCALA.map((s) => [s.id, s.nome])) as Record<
  SiglaDaEscala,
  string
>;

const TOM: Record<SiglaDaEscala, string> = {
  T: "bg-primary/10 text-foreground",
  F: "bg-muted text-muted-foreground",
  FE: "bg-muted text-foreground",
  AT: "bg-muted text-foreground",
};

function diasDoMes(mes: string, total: number): string[] {
  return Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`);
}

function fimDeSemana(dia: string): boolean {
  const [ano, mes, d] = dia.split("-").map(Number) as [number, number, number];
  const semana = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
  return semana === 0 || semana === 6;
}

function noVinculo(pessoa: PessoaDaEscala, dia: string): boolean {
  return pessoa.periodos.some((p) => p.inicio <= dia && (p.fim === null || dia < p.fim));
}

export function GradeDaEscala({ escala, usuario }: { escala: EscalaDoMes; usuario: string }) {
  const router = useRouter();
  const [aberta, setAberta] = useState<{ pessoa: PessoaDaEscala; dia: string } | null>(null);
  const quemAbriu = useRef<HTMLElement | null>(null);
  const dias = diasDoMes(escala.mes, escala.diasNoMes);
  const operacaoId = escala.operacao?.id ?? "";

  return (
    <ProvedorDoUsuario usuario={usuario}>
      <div
        className="border-border bg-card max-h-[70vh] overflow-auto rounded-xl border"
        data-testid="grade-da-escala"
      >
        <table className="border-separate border-spacing-0 text-xs">
          <caption className="sr-only">Escala do mês por pessoa e dia</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="bg-card border-border sticky top-0 left-0 z-20 border-b px-3 py-2 text-left text-sm font-medium"
              >
                Pessoa
              </th>
              {dias.map((dia) => (
                <th
                  key={dia}
                  scope="col"
                  aria-label={formatarData(dia)}
                  className={cn(
                    "bg-card border-border text-muted-foreground sticky top-0 z-10 min-w-9 border-b px-1 py-2 text-center font-medium tabular-nums",
                    fimDeSemana(dia) && "bg-muted",
                  )}
                >
                  {dia.slice(8)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {escala.pessoas.map((pessoa) => (
              <tr key={pessoa.id}>
                <th
                  scope="row"
                  className="bg-card border-border sticky left-0 z-10 border-b px-3 py-1.5 text-left font-normal"
                >
                  <span className="flex flex-col">
                    <span className="max-w-48 truncate text-sm">{pessoa.nome}</span>
                    <span className="text-muted-foreground max-w-48 truncate">
                      {pessoa.funcaoNome}
                    </span>
                  </span>
                </th>
                {dias.map((dia) => {
                  const marcacao = pessoa.dias[dia];
                  const rotulo = `${pessoa.nome}, ${formatarData(dia)}: ${
                    marcacao ? NOMES[marcacao.sigla] : "sem marcação"
                  }`;
                  const aberto = escala.podeMarcar && noVinculo(pessoa, dia);
                  return (
                    <td
                      key={dia}
                      className={cn(
                        "border-border border-b p-0.5 text-center",
                        fimDeSemana(dia) && "bg-muted/50",
                      )}
                    >
                      {aberto ? (
                        <button
                          type="button"
                          aria-label={`Marcar dia: ${rotulo}`}
                          title={rotulo}
                          className={cn(
                            "hover:ring-ring focus-visible:ring-ring/60 block h-7 w-full rounded font-medium outline-none hover:ring-1 focus-visible:ring-2",
                            marcacao && TOM[marcacao.sigla],
                          )}
                          onClick={(evento) => {
                            quemAbriu.current = evento.currentTarget;
                            setAberta({ pessoa, dia });
                          }}
                        >
                          {marcacao?.sigla ?? "·"}
                        </button>
                      ) : (
                        <span
                          title={rotulo}
                          className={cn(
                            "text-muted-foreground block h-7 leading-7",
                            marcacao && TOM[marcacao.sigla],
                          )}
                        >
                          {marcacao?.sigla ?? ""}
                        </span>
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
        T trabalho · F folga · FE férias · AT atestado. Clique num dia do vínculo para marcar; fora
        do vínculo o dia fica vazio.
      </p>
      {aberta && operacaoId ? (
        <MarcarDia
          pessoa={aberta.pessoa}
          operacaoId={operacaoId}
          dia={aberta.dia}
          focoFinal={quemAbriu}
          aoGravar={() => router.refresh()}
          aoFechar={() => setAberta(null)}
        />
      ) : null}
    </ProvedorDoUsuario>
  );
}
