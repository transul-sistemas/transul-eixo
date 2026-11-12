"use client";

import {
  IconCalendarEvent,
  IconClockExclamation,
  IconCornerDownRight,
  IconPencil,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useRef, useState } from "react";
import { formatarData } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { FaixaDeLegenda } from "@/components/legenda/faixa-de-legenda";
import { estiloDoTom } from "@/components/legenda/tom";
import { Placa } from "@/components/placa";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import { NOMES_DOS_TIPOS } from "@/lib/dados/placas-tipos";
import type {
  AlvoDoLancamento,
  CelulaDoConjunto,
  CelulaDoImplemento,
  ConjuntoDaGrade,
  GradePorConjunto as Grade,
  PlacaForaDeConjunto,
  TipoDeCrDaGrade,
} from "@/lib/dados/acompanhamento-tipos";
import { type DiaDaColuna, diasDoMes, rotuloDoSelo } from "@/lib/dominio/grade-por-conjunto";
import { ehSigla, NOMES_DAS_SIGLAS, tomDaSigla } from "@/lib/dominio/status";
import {
  type Densidade,
  DENSIDADES,
  montarCookieDaDensidade,
} from "@/lib/navegacao/preferencias-da-tabela";
import { cn } from "@/lib/utils";
import { LancarSituacao } from "./lancar-situacao";

// A grade por conjunto (A1): uma linha por conjunto (o cavalo, com os implementos recuados embaixo), uma
// coluna por dia do mês. A situação do cavalo vale para o conjunto; o selo da célula conta os lançamentos
// do dia. A largura é fluida: as colunas dos dias dividem o cartão (de 40 px a 80 px cada), a primeira
// coluna e o cabeçalho dos dias ficam fixos e a rolagem lateral é só dentro do cartão
// (docs/padrao-de-telas.md, "Tabela em grade preenche a largura; só rola por dentro").

const NOMES_DA_DENSIDADE: Record<Densidade, string> = {
  compacta: "Compacto",
  confortavel: "Confortável",
};
const NOMES_DOS_TIPOS_DE_CR: Record<TipoDeCrDaGrade, string> = {
  frota: "Frota",
  acionista: "Acionista",
};

/** A grade de colunas: o conjunto (fixo), um dia por coluna (fluida) e o olho. */
const COLUNAS = "var(--primeira) repeat(var(--dias), minmax(var(--min-dia), 1fr)) var(--olho)";
const LARGURA_MINIMA = "calc(var(--primeira) + var(--olho) + var(--dias) * var(--min-dia))";
const LARGURA_MAXIMA = "calc(var(--primeira) + var(--olho) + var(--dias) * var(--max-dia))";

function estiloDaGrade(dias: number): CSSProperties {
  return {
    "--dias": dias,
    "--primeira": "15rem",
    "--olho": "3rem",
    "--min-dia": "40px",
    "--max-dia": "80px",
  } as CSSProperties;
}

function tomDaCelula(sigla: string | null): CSSProperties | undefined {
  return sigla !== null && ehSigla(sigla) ? estiloDoTom(tomDaSigla(sigla)) : undefined;
}

/** "ETc, Em trânsito carregado": o nome da sigla para o balão do mouse e o leitor de tela. */
function nomeDaSigla(sigla: string | null): string {
  if (sigla === null) return "sem situação";
  return ehSigla(sigla) ? `${sigla}, ${NOMES_DAS_SIGLAS[sigla]}` : sigla;
}

/** O fundo da coluna: hoje destacado, fim de semana levemente diferente. */
function fundoDaColuna(coluna: DiaDaColuna): string {
  if (coluna.hoje) return "bg-[var(--grade-hoje)]";
  if (coluna.fimDeSemana) return "bg-[var(--grade-fim-de-semana)]";
  return "";
}

function SeletorDeDensidade({
  densidade,
  aoMudar,
}: {
  densidade: Densidade;
  aoMudar: (d: Densidade) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Densidade da grade"
      className="border-input bg-card inline-flex rounded-lg border p-0.5 text-sm"
    >
      {DENSIDADES.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={densidade === d}
          onClick={() => aoMudar(d)}
          className={cn(
            "focus-visible:ring-ring/50 rounded-md px-3 py-1 outline-none focus-visible:ring-3",
            densidade === d ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {NOMES_DA_DENSIDADE[d]}
        </button>
      ))}
    </div>
  );
}

function CabecalhoDosDias({
  colunas,
  rotuloDaPrimeira,
}: {
  colunas: DiaDaColuna[];
  rotuloDaPrimeira: string;
}) {
  return (
    <div
      role="row"
      className="bg-card border-border sticky top-0 z-20 grid border-b"
      style={{ gridTemplateColumns: COLUNAS }}
    >
      <div
        role="columnheader"
        className="bg-card sticky left-0 z-30 flex items-end px-3 py-2 text-sm font-medium"
      >
        {rotuloDaPrimeira}
      </div>
      {colunas.map((c) => (
        <div
          key={c.dia}
          role="columnheader"
          aria-label={`${formatarData(c.dia)}${c.hoje ? ", hoje" : ""}${c.fimDeSemana ? ", fim de semana" : ""}`}
          aria-current={c.hoje ? "date" : undefined}
          data-hoje={c.hoje ? "" : undefined}
          data-fim-de-semana={c.fimDeSemana ? "" : undefined}
          className={cn(
            "text-muted-foreground flex flex-col items-center justify-end border-b-2 border-transparent px-0.5 py-1.5 text-center text-xs leading-tight",
            fundoDaColuna(c),
            c.hoje && "text-foreground border-[var(--grade-hoje-borda)] font-semibold",
          )}
        >
          <span>{c.diaDaSemana}</span>
          <span className="text-foreground text-sm font-semibold tabular-nums">{c.numero}</span>
          {c.hoje ? (
            <span className="flex items-center gap-0.5 text-[10px] leading-none">
              <IconCalendarEvent aria-hidden className="size-3" />
              hoje
            </span>
          ) : null}
        </div>
      ))}
      <div role="columnheader" aria-label="Detalhes" />
    </div>
  );
}

function Selo({ celula }: { celula: CelulaDoConjunto }) {
  if (celula.eventos <= 0) return null;
  return (
    <span
      aria-hidden
      data-selo=""
      className="bg-foreground text-background absolute -top-1 -right-0.5 z-10 flex h-4 min-w-4 items-center justify-center gap-px rounded-full px-1 text-[10px] leading-none font-semibold tabular-nums"
    >
      {celula.tardia ? (
        <IconClockExclamation className="size-2.5" />
      ) : celula.manual ? (
        <IconPencil className="size-2.5" />
      ) : null}
      {formatarInteiro(celula.eventos)}
    </span>
  );
}

function CelulaDoCavalo({
  celula,
  coluna,
  placa,
  densidade,
  aoClicar,
}: {
  celula: CelulaDoConjunto;
  coluna: DiaDaColuna;
  placa: string;
  densidade: Densidade;
  aoClicar: (elemento: HTMLElement) => void;
}) {
  const altura = densidade === "confortavel" ? "h-11 text-sm" : "h-7 text-xs";
  const selo = rotuloDoSelo(celula);
  // Hoje sem nenhum lançamento: a célula convida a lançar (rótulo, não só cor).
  const faltaLancar = coluna.hoje && celula.eventos === 0;
  const rotulo = `${placa}, ${formatarData(coluna.dia)}: ${nomeDaSigla(celula.sigla)}${selo ? `, ${selo}` : ""}${faltaLancar ? ", sem lançamento hoje" : ""}`;
  return (
    <div
      role="gridcell"
      data-dia={coluna.dia}
      className={cn("flex items-center px-0.5 py-0.5", fundoDaColuna(coluna))}
    >
      {coluna.futuro ? (
        <span aria-hidden className={cn("block w-full", altura)} />
      ) : (
        <button
          type="button"
          aria-label={`Lançar situação: ${rotulo}`}
          title={rotulo}
          style={faltaLancar ? undefined : tomDaCelula(celula.sigla)}
          className={cn(
            "hover:ring-ring focus-visible:ring-ring/60 relative block w-full rounded font-medium outline-none hover:ring-1 focus-visible:ring-2",
            altura,
            faltaLancar &&
              "border-[1.5px] border-dashed border-[var(--grade-hoje-borda)] bg-transparent text-[var(--grade-hoje-borda)]",
          )}
          onClick={(evento) => aoClicar(evento.currentTarget)}
        >
          {faltaLancar ? "lançar" : (celula.sigla ?? "—")}
          <Selo celula={celula} />
        </button>
      )}
    </div>
  );
}

function CelulaDoImplementoNoDia({
  celula,
  coluna,
  placa,
  densidade,
}: {
  celula: CelulaDoImplemento;
  coluna: DiaDaColuna;
  placa: string;
  densidade: Densidade;
}) {
  const altura = densidade === "confortavel" ? "h-8 text-xs" : "h-5 text-[11px]";
  const rotulo = celula.engatado
    ? `${placa}, ${formatarData(coluna.dia)}: ${nomeDaSigla(celula.sigla)} (herdada do cavalo)`
    : `${placa}, ${formatarData(coluna.dia)}: fora do conjunto`;
  return (
    <div
      role="gridcell"
      data-dia={coluna.dia}
      className={cn("flex items-center px-0.5 py-0.5", fundoDaColuna(coluna))}
    >
      {coluna.futuro ? (
        <span aria-hidden className={cn("block w-full", altura)} />
      ) : celula.engatado ? (
        <span
          title={rotulo}
          aria-label={rotulo}
          style={tomDaCelula(celula.sigla)}
          className={cn("flex w-full items-center justify-center rounded font-medium", altura)}
        >
          {celula.sigla ?? "—"}
        </span>
      ) : (
        <span
          title={rotulo}
          aria-label={rotulo}
          className={cn(
            "text-muted-foreground flex w-full items-center justify-center rounded",
            altura,
          )}
        >
          ·
        </span>
      )}
    </div>
  );
}

function EtiquetaDeCr({ tipos }: { tipos: TipoDeCrDaGrade[] }) {
  if (tipos.length === 0) return null;
  return (
    <>
      {tipos.map((t) => (
        <span
          key={t}
          className="bg-muted text-foreground rounded-full px-2 py-0.5 text-xs font-medium"
        >
          {NOMES_DOS_TIPOS_DE_CR[t]}
        </span>
      ))}
    </>
  );
}

function OlhoDaLinha({
  placa,
  detalhes,
}: {
  placa: string;
  detalhes: { rotulo: string; valor: ReactNode }[];
}) {
  return (
    <div role="gridcell" className="flex items-center justify-center">
      <BotaoDoOlho
        item={placa}
        detalhes={detalhes}
        hrefDaFicha={`/frota/placas/${placa}`}
        titulo={<Placa placa={placa} tamanho="m" />}
      />
    </div>
  );
}

function textoDoModelo(modelo: string, ano: number | null): string {
  return ano === null ? modelo : `${modelo} · ${String(ano)}`;
}

function LinhaDoConjunto({
  conjunto,
  colunas,
  densidade,
  aoLancar,
}: {
  conjunto: ConjuntoDaGrade;
  colunas: DiaDaColuna[];
  densidade: Densidade;
  aoLancar: (alvo: AlvoDoLancamento, dia: string, elemento: HTMLElement) => void;
}) {
  const alvoDoDia = (dia: string): AlvoDoLancamento => ({
    ativoId: conjunto.ativoId,
    placa: conjunto.placa,
    tipo: "cavalo",
    emConjunto: conjunto.implementos.some((i) => i.dias.find((d) => d.dia === dia)?.engatado),
    dias: conjunto.dias.map((d) => ({ dia: d.dia, sigla: d.sigla })),
  });
  return (
    <div
      role="rowgroup"
      className="border-border border-b last:border-b-0"
      data-conjunto={conjunto.placa}
    >
      <div
        role="row"
        className="grid items-center"
        style={{ gridTemplateColumns: COLUNAS }}
        data-linha="conjunto"
      >
        <div
          role="rowheader"
          className="bg-card sticky left-0 z-10 flex min-w-0 flex-col gap-1 px-3 py-1.5"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <Placa placa={conjunto.placa} tamanho="p" />
            <EtiquetaDeCr tipos={conjunto.tiposDeCr} />
            {conjunto.nomeDoConjunto ? (
              <span className="bg-acao-suave text-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                {conjunto.nomeDoConjunto}
              </span>
            ) : null}
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {textoDoModelo(conjunto.modelo, conjunto.ano)}
          </span>
        </div>
        {colunas.map((c) => {
          const celula = conjunto.dias.find((d) => d.dia === c.dia);
          return celula ? (
            <CelulaDoCavalo
              key={c.dia}
              celula={celula}
              coluna={c}
              placa={conjunto.placa}
              densidade={densidade}
              aoClicar={(el) => aoLancar(alvoDoDia(c.dia), c.dia, el)}
            />
          ) : (
            <div key={c.dia} role="gridcell" />
          );
        })}
        <OlhoDaLinha
          placa={conjunto.placa}
          detalhes={[
            { rotulo: "Conjunto", valor: conjunto.nomeDoConjunto ?? "Sem implemento" },
            { rotulo: "Modelo", valor: textoDoModelo(conjunto.modelo, conjunto.ano) },
            { rotulo: "Operação", valor: conjunto.operacao ?? "Sem operação" },
            {
              rotulo: "CR vigente",
              valor:
                conjunto.tiposDeCr.map((t) => NOMES_DOS_TIPOS_DE_CR[t]).join(" e ") ||
                "Sem CR de frota",
            },
            { rotulo: "Situação agora", valor: nomeDaSigla(conjunto.siglaAtual) },
            {
              rotulo: "Implementos no mês",
              valor: conjunto.implementos.map((i) => i.placa).join(", ") || "Nenhum",
            },
          ]}
        />
      </div>
      {conjunto.implementos.map((i) => (
        <div
          key={i.ativoId}
          role="row"
          className="grid items-center"
          style={{ gridTemplateColumns: COLUNAS }}
          data-linha="implemento"
        >
          <div
            role="rowheader"
            className="bg-card text-muted-foreground sticky left-0 z-10 flex min-w-0 items-center gap-1.5 py-0.5 pr-3 pl-6 text-xs"
          >
            <IconCornerDownRight aria-hidden className="size-3.5 shrink-0" />
            <Placa placa={i.placa} tamanho="p" />
            <span className="truncate">{i.modelo}</span>
          </div>
          {colunas.map((c) => {
            const celula = i.dias.find((d) => d.dia === c.dia);
            return celula ? (
              <CelulaDoImplementoNoDia
                key={c.dia}
                celula={celula}
                coluna={c}
                placa={i.placa}
                densidade={densidade}
              />
            ) : (
              <div key={c.dia} role="gridcell" />
            );
          })}
          <div role="gridcell" />
        </div>
      ))}
    </div>
  );
}

function LinhaForaDeConjunto({
  placa,
  colunas,
  densidade,
  aoLancar,
}: {
  placa: PlacaForaDeConjunto;
  colunas: DiaDaColuna[];
  densidade: Densidade;
  aoLancar: (alvo: AlvoDoLancamento, dia: string, elemento: HTMLElement) => void;
}) {
  const alvo: AlvoDoLancamento = {
    ativoId: placa.ativoId,
    placa: placa.placa,
    tipo: placa.tipo,
    emConjunto: false,
    dias: placa.dias.map((d) => ({ dia: d.dia, sigla: d.sigla })),
  };
  return (
    <div
      role="row"
      className="border-border grid items-center border-b last:border-b-0"
      style={{ gridTemplateColumns: COLUNAS }}
      data-linha="fora"
    >
      <div
        role="rowheader"
        className="bg-card sticky left-0 z-10 flex min-w-0 flex-col gap-1 px-3 py-1.5"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <Placa placa={placa.placa} tamanho="p" />
          <span className="bg-muted text-foreground rounded-full px-2 py-0.5 text-xs font-medium">
            {NOMES_DOS_TIPOS[placa.tipo]}
          </span>
          <EtiquetaDeCr tipos={placa.tiposDeCr} />
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {textoDoModelo(placa.modelo, placa.ano)}
        </span>
      </div>
      {colunas.map((c) => {
        const celula = placa.dias.find((d) => d.dia === c.dia);
        return celula ? (
          <CelulaDoCavalo
            key={c.dia}
            celula={celula}
            coluna={c}
            placa={placa.placa}
            densidade={densidade}
            aoClicar={(el) => aoLancar(alvo, c.dia, el)}
          />
        ) : (
          <div key={c.dia} role="gridcell" />
        );
      })}
      <OlhoDaLinha
        placa={placa.placa}
        detalhes={[
          { rotulo: "Tipo", valor: NOMES_DOS_TIPOS[placa.tipo] },
          { rotulo: "Modelo", valor: textoDoModelo(placa.modelo, placa.ano) },
          { rotulo: "Operação", valor: placa.operacao ?? "Sem operação" },
          { rotulo: "Situação agora", valor: nomeDaSigla(placa.siglaAtual) },
        ]}
      />
    </div>
  );
}

/** O cartão que rola por dentro: a página nunca ganha rolagem lateral. */
function CartaoDaGrade({
  dias,
  testid,
  rotulo,
  children,
}: {
  dias: number;
  testid: string;
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={testid}
      className="border-border bg-card max-h-[max(24rem,calc(100dvh-20rem))] w-full overflow-auto rounded-xl border"
      style={{ ...estiloDaGrade(dias), maxWidth: LARGURA_MAXIMA }}
    >
      <div role="grid" aria-label={rotulo} style={{ minWidth: LARGURA_MINIMA }}>
        {children}
      </div>
    </div>
  );
}

export function GradePorConjunto({
  grade,
  densidadeInicial,
  vazioDosConjuntos,
  aposOsConjuntos,
  aposOFora,
}: {
  grade: Grade;
  densidadeInicial: Densidade;
  /** No lugar da grade dos conjuntos quando nenhum passa pelos filtros. */
  vazioDosConjuntos?: ReactNode;
  /** O que vem sob a grade dos conjuntos (o paginador, feito no servidor). */
  aposOsConjuntos?: ReactNode;
  /** O que vem sob a seção "Fora de conjunto". */
  aposOFora?: ReactNode;
}) {
  const router = useRouter();
  const [densidade, setDensidade] = useState(densidadeInicial);
  const [aberta, setAberta] = useState<{ alvo: AlvoDoLancamento; dia: string } | null>(null);
  const quemAbriu = useRef<HTMLElement | null>(null);
  const colunas = diasDoMes(grade.mes.slice(0, 7), grade.hoje);
  const lancar = (alvo: AlvoDoLancamento, dia: string, elemento: HTMLElement) => {
    quemAbriu.current = elemento;
    setAberta({ alvo, dia });
  };
  const mudarDensidade = (d: Densidade) => {
    setDensidade(d);
    try {
      document.cookie = montarCookieDaDensidade(d, window.location.protocol);
    } catch {
      // Sem cookie, a escolha vale só nesta tela.
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Conjuntos</h2>
        <SeletorDeDensidade densidade={densidade} aoMudar={mudarDensidade} />
      </div>
      {grade.total === 0 ? (
        vazioDosConjuntos
      ) : (
        <CartaoDaGrade
          dias={colunas.length}
          testid="grade-do-mes"
          rotulo="Conjuntos por dia do mês"
        >
          <CabecalhoDosDias colunas={colunas} rotuloDaPrimeira="Conjunto" />
          {grade.linhas.map((c) => (
            <LinhaDoConjunto
              key={c.ativoId}
              conjunto={c}
              colunas={colunas}
              densidade={densidade}
              aoLancar={lancar}
            />
          ))}
        </CartaoDaGrade>
      )}
      {aposOsConjuntos}

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold" id="fora-de-conjunto">
          Fora de conjunto
        </h2>
        <span className="text-muted-foreground text-sm" data-testid="total-fora-de-conjunto">
          {formatarInteiro(grade.fora.total)} placas
        </span>
      </div>
      {grade.fora.total === 0 ? (
        <p className="text-muted-foreground border-border bg-card rounded-xl border px-4 py-3 text-sm">
          Nenhuma placa fora de conjunto neste mês. Cavalo sem implemento, caminhão, apoio,
          equipamento e implemento solto aparecem aqui.
        </p>
      ) : (
        <CartaoDaGrade
          dias={colunas.length}
          testid="grade-fora-de-conjunto"
          rotulo="Placas fora de conjunto por dia do mês"
        >
          <CabecalhoDosDias colunas={colunas} rotuloDaPrimeira="Placa" />
          {grade.fora.linhas.map((p) => (
            <LinhaForaDeConjunto
              key={p.ativoId}
              placa={p}
              colunas={colunas}
              densidade={densidade}
              aoLancar={lancar}
            />
          ))}
        </CartaoDaGrade>
      )}
      {aposOFora}

      <FaixaDeLegenda />
      <p className="text-muted-foreground text-xs">
        Cada célula mostra a situação no fim do dia (hoje, a de agora). O implemento engatado herda
        a situação do cavalo; fora do conjunto aparece um ponto. O número no canto da célula conta
        os lançamentos do dia. Clique numa célula para lançar a situação daquele dia.
      </p>
      {aberta ? (
        <LancarSituacao
          alvo={aberta.alvo}
          dia={aberta.dia}
          focoFinal={quemAbriu}
          aoGravar={() => router.refresh()}
          aoFechar={() => setAberta(null)}
        />
      ) : null}
    </>
  );
}
