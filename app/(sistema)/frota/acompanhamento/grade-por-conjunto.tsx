"use client";

import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconClockExclamation,
  IconPencil,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useRef, useState } from "react";
import { formatarData } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { FaixaDeLegenda } from "@/components/legenda/faixa-de-legenda";
import { estiloDoTom } from "@/components/legenda/tom";
import { Placa } from "@/components/placa";
import { BotaoDoOlho, type DetalheDoItem } from "@/components/tabela/botao-do-olho";
import type {
  AlvoDoLancamento,
  CelulaDoConjunto,
  ConjuntoDaGrade,
  GradeDeSoltas as DadosDasSoltas,
  GradePorConjunto as DadosDosConjuntos,
  ImplementoDoConjunto,
  PlacaSolta,
  TipoDeCrDaGrade,
} from "@/lib/dados/acompanhamento-tipos";
import { NOMES_DOS_TIPOS } from "@/lib/dados/placas-tipos";
import {
  type DiaDaColuna,
  diasDoMes,
  rotuloDaCausa,
  rotuloDoSelo,
} from "@/lib/dominio/grade-por-conjunto";
import { ehSigla, NOMES_DAS_SIGLAS, tomDaSigla } from "@/lib/dominio/status";
import {
  type Densidade,
  DENSIDADES,
  montarCookieDaDensidade,
} from "@/lib/navegacao/preferencias-da-tabela";
import { cn } from "@/lib/utils";
import { LancarSituacao } from "./lancar-situacao";

// A grade por conjunto (A1), com o conjunto numa peça só: uma linha e um só conjunto de células por conjunto.
// O cavalo (ou o caminhão) é a cara; os implementos são chips pequenos na célula da esquerda, sem células
// próprias. Se um implemento engatado impede o conjunto, a célula do dia fica impedida e diz a causa
// ("impedido por <placa> · <sigla>"). A aba Soltas usa a mesma grade, uma linha por placa.
//
// A largura é fluida: as colunas dos dias dividem o cartão (de 34 px a 80 px cada), a primeira coluna e o
// cabeçalho dos dias ficam fixos e a rolagem é só dentro do cartão (docs/padrao-de-telas.md, "Tabela em
// grade preenche a largura; só rola por dentro"). O cartão encolhe com a altura da janela (a página nunca
// rola na vertical).

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
    "--primeira": "12rem",
    "--olho": "3rem",
    "--min-dia": "34px",
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

const ALTURA_DA_LINHA: Record<Densidade, string> = {
  compacta: "min-h-16",
  confortavel: "min-h-[84px]",
};
const ALTURA_DA_CELULA: Record<Densidade, string> = {
  compacta: "h-9 text-xs",
  confortavel: "h-12 text-sm",
};

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

/** A célula de um dia (conjunto ou solta): a sigla no tom da régua, o selo e, se há, a causa do impedimento. */
function CelulaDoDia({
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
  const altura = ALTURA_DA_CELULA[densidade];
  const selo = rotuloDoSelo(celula);
  const causa = rotuloDaCausa(celula.causas ?? []);
  // Hoje sem nenhum lançamento: a célula convida a lançar (rótulo, não só cor).
  const faltaLancar = coluna.hoje && celula.eventos === 0 && !causa;
  const rotulo = [
    `${placa}, ${formatarData(coluna.dia)}: ${nomeDaSigla(celula.sigla)}`,
    causa,
    selo,
    faltaLancar ? "sem lançamento hoje" : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div
      role="gridcell"
      data-dia={coluna.dia}
      className={cn("flex items-center px-0.5 py-1", fundoDaColuna(coluna))}
    >
      {coluna.futuro ? (
        <span aria-hidden className={cn("block w-full", altura)} />
      ) : (
        <button
          type="button"
          aria-label={`Lançar situação: ${rotulo}`}
          title={rotulo}
          data-causa={causa ? "" : undefined}
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
          {causa ? (
            <IconAlertTriangle aria-hidden className="absolute bottom-0.5 left-0.5 size-3" />
          ) : null}
          <Selo celula={celula} />
        </button>
      )}
    </div>
  );
}

function EtiquetaDeCr({ tipos }: { tipos: TipoDeCrDaGrade[] }) {
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

function textoDoModelo(modelo: string, ano: number | null): string {
  return ano === null ? modelo : `${modelo} · ${String(ano)}`;
}

function periodoDoEngate(i: ImplementoDoConjunto): string {
  return i.engatadoAte === null
    ? `engatado desde ${formatarData(i.engatadoDe)}`
    : `engatado de ${formatarData(i.engatadoDe)} a ${formatarData(i.engatadoAte)}`;
}

function OlhoDaLinha({ placa, detalhes }: { placa: string; detalhes: DetalheDoItem[] }) {
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

/** Os implementos, como chips pequenos: "+ N implementos" e as placas em tamanho menor. */
function ChipsDosImplementos({ implementos }: { implementos: ImplementoDoConjunto[] }) {
  if (implementos.length === 0) return null;
  return (
    <span
      className="text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] leading-none"
      data-chips-dos-implementos=""
    >
      <span>
        + {formatarInteiro(implementos.length)}{" "}
        {implementos.length === 1 ? "implemento" : "implementos"}
      </span>
      {implementos.map((i) => (
        <span
          key={i.ativoId}
          title={`${i.placa}, ${i.modelo}, ${periodoDoEngate(i)}`}
          data-implemento={i.placa}
        >
          <Placa
            placa={i.placa}
            tamanho="p"
            className="[&_span]:text-[10px] [&_span]:leading-none"
          />
        </span>
      ))}
    </span>
  );
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
    emConjunto: conjunto.implementos.some(
      (i) => i.engatadoDe <= dia && (i.engatadoAte === null || dia <= i.engatadoAte),
    ),
    dias: conjunto.dias.map((d) => ({ dia: d.dia, sigla: d.sigla })),
  });
  const hoje = colunas.find((c) => c.hoje);
  const causasDeHoje = hoje ? (conjunto.dias.find((d) => d.dia === hoje.dia)?.causas ?? []) : [];
  const causaDeHoje = rotuloDaCausa(causasDeHoje);
  const detalhes: DetalheDoItem[] = [
    { rotulo: "Conjunto", valor: conjunto.nomeDoConjunto ?? "Sem implemento" },
    { rotulo: "Modelo", valor: textoDoModelo(conjunto.modelo, conjunto.ano) },
    { rotulo: "Operação", valor: conjunto.operacao ?? "Sem operação" },
    {
      rotulo: "CR vigente",
      valor:
        conjunto.tiposDeCr.map((t) => NOMES_DOS_TIPOS_DE_CR[t]).join(" e ") || "Sem CR de frota",
    },
    { rotulo: "Situação agora", valor: nomeDaSigla(conjunto.siglaAtual) },
    ...(causaDeHoje ? [{ rotulo: "Hoje", valor: causaDeHoje }] : []),
    ...conjunto.implementos.map((i, n) => ({
      rotulo: `Implemento ${formatarInteiro(n + 1)}`,
      valor: `${i.placa} · ${i.modelo} · ${periodoDoEngate(i)} · ${nomeDaSigla(i.siglaAtual)}`,
    })),
  ];
  return (
    <div
      role="row"
      className={cn(
        "border-border grid items-center border-b last:border-b-0",
        ALTURA_DA_LINHA[densidade],
      )}
      style={{ gridTemplateColumns: COLUNAS }}
      data-linha="conjunto"
      data-conjunto={conjunto.placa}
    >
      <div
        role="rowheader"
        className="bg-card sticky left-0 z-10 flex min-w-0 flex-col gap-1 self-stretch px-3 py-1.5"
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
        <ChipsDosImplementos implementos={conjunto.implementos} />
      </div>
      {colunas.map((c) => {
        const celula = conjunto.dias.find((d) => d.dia === c.dia);
        return celula ? (
          <CelulaDoDia
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
      <OlhoDaLinha placa={conjunto.placa} detalhes={detalhes} />
    </div>
  );
}

function LinhaDaSolta({
  placa,
  colunas,
  densidade,
  aoLancar,
}: {
  placa: PlacaSolta;
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
      className={cn(
        "border-border grid items-center border-b last:border-b-0",
        ALTURA_DA_LINHA[densidade],
      )}
      style={{ gridTemplateColumns: COLUNAS }}
      data-linha="solta"
      data-solta={placa.placa}
    >
      <div
        role="rowheader"
        className="bg-card sticky left-0 z-10 flex min-w-0 flex-col gap-1 self-stretch px-3 py-1.5"
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
          <CelulaDoDia
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

/**
 * O cartão que rola por dentro: a página nunca rola de lado nem na vertical. Ele encolhe com a janela
 * (`shrink`, `min-h-0`) e o cabeçalho dos dias e a primeira coluna ficam fixos.
 */
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
      className="border-border bg-card min-h-0 w-full shrink overflow-auto rounded-xl border"
      style={{ ...estiloDaGrade(dias), maxWidth: LARGURA_MAXIMA }}
    >
      <div role="grid" aria-label={rotulo} style={{ minWidth: LARGURA_MINIMA }}>
        {children}
      </div>
    </div>
  );
}

function useGrade(densidadeInicial: Densidade) {
  const router = useRouter();
  const [densidade, setDensidade] = useState(densidadeInicial);
  const [aberta, setAberta] = useState<{ alvo: AlvoDoLancamento; dia: string } | null>(null);
  const quemAbriu = useRef<HTMLElement | null>(null);
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
  const assistente = aberta ? (
    <LancarSituacao
      alvo={aberta.alvo}
      dia={aberta.dia}
      focoFinal={quemAbriu}
      aoGravar={() => router.refresh()}
      aoFechar={() => setAberta(null)}
    />
  ) : null;
  return { densidade, mudarDensidade, lancar, assistente };
}

function RodapeDaGrade({
  paginador,
  densidade,
  aoMudar,
}: {
  paginador: ReactNode;
  densidade: Densidade;
  aoMudar: (d: Densidade) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {paginador}
      <SeletorDeDensidade densidade={densidade} aoMudar={aoMudar} />
    </div>
  );
}

/** A aba Conjuntos: uma linha por conjunto, os implementos como chips, a causa do impedimento na célula. */
export function GradeDosConjuntos({
  grade,
  densidadeInicial,
  vazio,
  paginador,
}: {
  grade: DadosDosConjuntos;
  densidadeInicial: Densidade;
  /** No lugar da grade quando nenhum conjunto passa pelos filtros. */
  vazio?: ReactNode;
  /** O paginador, feito no servidor, ao lado do seletor de densidade. */
  paginador: ReactNode;
}) {
  const { densidade, mudarDensidade, lancar, assistente } = useGrade(densidadeInicial);
  const colunas = diasDoMes(grade.mes.slice(0, 7), grade.hoje);
  return (
    <>
      {grade.total === 0 ? (
        vazio
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
      <RodapeDaGrade paginador={paginador} densidade={densidade} aoMudar={mudarDensidade} />
      <FaixaDeLegenda />
      {assistente}
    </>
  );
}

/** A aba Soltas: implemento sem cavalo engatado no mês, apoio e equipamento, uma linha por placa. */
export function GradeDeSoltas({
  grade,
  densidadeInicial,
  vazio,
  paginador,
}: {
  grade: DadosDasSoltas;
  densidadeInicial: Densidade;
  vazio?: ReactNode;
  paginador: ReactNode;
}) {
  const { densidade, mudarDensidade, lancar, assistente } = useGrade(densidadeInicial);
  const colunas = diasDoMes(grade.mes.slice(0, 7), grade.hoje);
  return (
    <>
      {grade.total === 0 ? (
        vazio
      ) : (
        <CartaoDaGrade
          dias={colunas.length}
          testid="grade-de-soltas"
          rotulo="Placas soltas por dia do mês"
        >
          <CabecalhoDosDias colunas={colunas} rotuloDaPrimeira="Placa" />
          {grade.linhas.map((p) => (
            <LinhaDaSolta
              key={p.ativoId}
              placa={p}
              colunas={colunas}
              densidade={densidade}
              aoLancar={lancar}
            />
          ))}
        </CartaoDaGrade>
      )}
      <RodapeDaGrade paginador={paginador} densidade={densidade} aoMudar={mudarDensidade} />
      <FaixaDeLegenda />
      {assistente}
    </>
  );
}
