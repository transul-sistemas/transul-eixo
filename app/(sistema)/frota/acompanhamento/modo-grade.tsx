import Link from "next/link";
import { formatarData, formatarMes } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { ListaVazia } from "@/components/tabela/estados";
import { SeletorDeTamanho } from "@/components/tabela/seletor-de-tamanho";
import { type GradePorConjunto, lerGradePorConjunto } from "@/lib/dados/acompanhamento";
import { medidaDoDia } from "@/lib/dominio/grade-por-conjunto";
import { NOMES_DOS_CHIPS } from "@/lib/dominio/status";
import {
  enderecoDoAcompanhamento,
  type EstadoDoAcompanhamento,
  mesVizinho,
  TIPOS_DE_CR_DA_GRADE,
} from "@/lib/navegacao/acompanhamento";
import { type Densidade, TAMANHOS_DE_PAGINA } from "@/lib/navegacao/preferencias-da-tabela";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { cn } from "@/lib/utils";
import { STATUS, variavelDoStatus } from "@/lib/visual/tons";
import { GradePorConjunto as GradeDosConjuntos } from "./grade-por-conjunto";

// O modo Grade do Acompanhamento (A1): a faixa do dia ("X de Y conjuntos com lançamento hoje"), os chips
// com contagem, o mês, a busca e a grade por conjunto. X, Y, o total e a contagem dos chips vêm do banco.

const ROTA = "/frota/acompanhamento";
const NOMES_DOS_TIPOS_DE_CR = { frota: "Frota", acionista: "Acionista" } as const;

const classeDoLink =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";

const classeDoChip =
  "focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm outline-none focus-visible:ring-3";

const chipLigado = "bg-primary text-primary-foreground border-primary";
const chipDesligado = "border-input bg-card hover:bg-muted";

/** A faixa do dia: "X de Y conjuntos com lançamento hoje" (X e Y vêm do banco) e a barra de progresso. */
function FaixaDoDia({ grade }: { grade: GradePorConjunto }) {
  const medida = medidaDoDia(grade.lancamentoHoje.x, grade.lancamentoHoje.y);
  return (
    <section
      aria-label="Hoje"
      data-testid="faixa-do-dia"
      className="border-border bg-card flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border px-4 py-3"
    >
      <span className="text-base font-semibold">Hoje, {formatarData(grade.hoje)}</span>
      {medida.tipo === "vazia" ? (
        <span className="text-muted-foreground text-sm" data-testid="x-de-y">
          Sem dados ainda: depende de conjuntos ativos no dia
        </span>
      ) : (
        <>
          <span className="text-muted-foreground text-sm" data-testid="x-de-y">
            <b className="text-foreground tabular-nums">
              {formatarInteiro(medida.x)} de {formatarInteiro(medida.y)}
            </b>{" "}
            conjuntos com lançamento hoje
          </span>
          <progress
            value={medida.x}
            max={medida.y}
            aria-label="Conjuntos com lançamento hoje"
            className="h-2 w-44 overflow-hidden rounded-full [&::-moz-progress-bar]:bg-[var(--acao)] [&::-webkit-progress-bar]:bg-[var(--linha)] [&::-webkit-progress-value]:bg-[var(--acao)]"
          />
        </>
      )}
    </section>
  );
}

/** Os chips da régua com a contagem por grupo (do banco) e o tipo do CR; cada um filtra a grade pela URL. */
function ChipsDaGrade({
  estado,
  grade,
  hoje,
}: {
  estado: EstadoDoAcompanhamento;
  grade: GradePorConjunto;
  hoje: string;
}) {
  const ir = (mudanca: Partial<EstadoDoAcompanhamento>) =>
    enderecoDoAcompanhamento({ ...estado, ...mudanca, pagina: 1, foraPagina: 1 }, hoje);
  return (
    <div className="flex flex-col gap-2" data-testid="chips-da-grade">
      <nav aria-label="Situação do conjunto" className="flex flex-wrap items-center gap-2">
        <Link
          href={ir({ grupo: null })}
          aria-current={estado.grupo === null ? "true" : undefined}
          className={cn(classeDoChip, estado.grupo === null ? chipLigado : chipDesligado)}
        >
          Todos <b className="tabular-nums">{formatarInteiro(grade.chips.todos)}</b>
        </Link>
        {STATUS.map((g) => {
          const quantidade = grade.chips[g];
          return (
            <Link
              key={g}
              href={ir({ grupo: estado.grupo === g ? null : g })}
              aria-current={estado.grupo === g ? "true" : undefined}
              className={cn(
                classeDoChip,
                estado.grupo === g ? chipLigado : chipDesligado,
                quantidade === 0 && estado.grupo !== g && "text-muted-foreground",
              )}
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: `var(${variavelDoStatus(g)})` }}
              />
              {NOMES_DOS_CHIPS[g]} <b className="tabular-nums">{formatarInteiro(quantidade)}</b>
            </Link>
          );
        })}
      </nav>
      <nav aria-label="Tipo do CR" className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">CR vigente</span>
        {TIPOS_DE_CR_DA_GRADE.map((t) => (
          <Link
            key={t}
            href={ir({ tipoDeCr: estado.tipoDeCr === t ? null : t })}
            aria-current={estado.tipoDeCr === t ? "true" : undefined}
            className={cn(classeDoChip, estado.tipoDeCr === t ? chipLigado : chipDesligado)}
          >
            {NOMES_DOS_TIPOS_DE_CR[t]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** A busca da grade: um formulário GET (placa do cavalo ou do implemento), para o estado ficar na URL. */
function BuscaDaGrade({ estado }: { estado: EstadoDoAcompanhamento }) {
  return (
    <form method="get" action={ROTA} className="flex flex-wrap items-end gap-3" role="search">
      <input type="hidden" name="modo" value="grade" />
      <input type="hidden" name="mes" value={estado.mes} />
      {estado.grupo ? <input type="hidden" name="chip" value={estado.grupo} /> : null}
      {estado.tipoDeCr ? <input type="hidden" name="cr" value={estado.tipoDeCr} /> : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Buscar placa</span>
        <input
          type="search"
          name="busca"
          defaultValue={estado.busca}
          className="border-input bg-card h-9 w-48 rounded-lg border px-3"
        />
      </label>
      <button type="submit" className={classeDoLink}>
        Buscar
      </button>
    </form>
  );
}

function PaginadorDosConjuntos({
  estado,
  grade,
  hoje,
}: {
  estado: EstadoDoAcompanhamento;
  grade: GradePorConjunto;
  hoje: string;
}) {
  return (
    <nav aria-label="Páginas dos conjuntos" className="flex flex-wrap items-center gap-3 text-sm">
      <span data-testid="total-da-grade" className="text-muted-foreground">
        {formatarInteiro(grade.total)} conjuntos · página {formatarInteiro(grade.pagina)} de{" "}
        {formatarInteiro(grade.paginas)}
      </span>
      <SeletorDeTamanho
        tam={estado.tam}
        enderecos={Object.fromEntries(
          TAMANHOS_DE_PAGINA.map((t) => [
            t,
            enderecoDoAcompanhamento({ ...estado, tam: t, pagina: 1, foraPagina: 1 }, hoje),
          ]),
        )}
      />
      {grade.pagina > 1 ? (
        <Link
          className={classeDoLink}
          href={enderecoDoAcompanhamento({ ...estado, pagina: grade.pagina - 1 }, hoje)}
        >
          Página anterior
        </Link>
      ) : null}
      {grade.pagina < grade.paginas ? (
        <Link
          className={classeDoLink}
          href={enderecoDoAcompanhamento({ ...estado, pagina: grade.pagina + 1 }, hoje)}
        >
          Próxima página
        </Link>
      ) : null}
    </nav>
  );
}

function PaginadorDoFora({
  estado,
  grade,
  hoje,
}: {
  estado: EstadoDoAcompanhamento;
  grade: GradePorConjunto;
  hoje: string;
}) {
  if (grade.fora.paginas <= 1) return null;
  const ir = (foraPagina: number) =>
    `${enderecoDoAcompanhamento({ ...estado, foraPagina }, hoje)}#fora-de-conjunto`;
  return (
    <nav
      aria-label="Páginas de fora de conjunto"
      className="flex flex-wrap items-center gap-3 text-sm"
    >
      <span data-testid="pagina-do-fora" className="text-muted-foreground">
        Página {formatarInteiro(grade.fora.pagina)} de {formatarInteiro(grade.fora.paginas)}
      </span>
      {grade.fora.pagina > 1 ? (
        <Link className={classeDoLink} href={ir(grade.fora.pagina - 1)}>
          Página anterior
        </Link>
      ) : null}
      {grade.fora.pagina < grade.fora.paginas ? (
        <Link className={classeDoLink} href={ir(grade.fora.pagina + 1)}>
          Próxima página
        </Link>
      ) : null}
    </nav>
  );
}

export async function ModoGrade({
  estado,
  hoje,
  densidade,
}: {
  estado: EstadoDoAcompanhamento;
  hoje: string;
  densidade: Densidade;
}) {
  // O assistente "Lançar situação" guarda o rascunho pelo usuário da sessão (ProvedorDoUsuario).
  const [grade, sessao] = await Promise.all([
    lerGradePorConjunto({
      mes: estado.mes,
      busca: estado.busca,
      tipoDeCr: estado.tipoDeCr,
      grupo: estado.grupo,
      pagina: estado.pagina,
      foraPagina: estado.foraPagina,
      tam: estado.tam,
    }),
    exigirSessao(),
  ]);
  const mesAtual = hoje.slice(0, 7);
  const filtrada = Boolean(estado.busca || estado.tipoDeCr || estado.grupo);
  const limpar = enderecoDoAcompanhamento(
    { ...estado, busca: "", tipoDeCr: null, grupo: null, pagina: 1, foraPagina: 1 },
    hoje,
  );
  const mes = (passo: -1 | 1) =>
    enderecoDoAcompanhamento(
      { ...estado, mes: mesVizinho(estado.mes, passo), pagina: 1, foraPagina: 1 },
      hoje,
    );
  return (
    <>
      <FaixaDoDia grade={grade} />
      <ChipsDaGrade estado={estado} grade={grade} hoje={hoje} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2" aria-label="Mês da grade">
          <Link className={classeDoLink} href={mes(-1)}>
            Mês anterior
          </Link>
          <span
            className="min-w-20 text-center font-semibold tabular-nums"
            data-testid="mes-da-grade"
          >
            {formatarMes(estado.mes)}
          </span>
          {estado.mes < mesAtual ? (
            <Link className={classeDoLink} href={mes(1)}>
              Próximo mês
            </Link>
          ) : null}
        </div>
        <BuscaDaGrade estado={estado} />
      </div>
      {grade.total === 0 && grade.fora.total === 0 ? (
        <ListaVazia
          titulo={
            filtrada
              ? `Nenhum conjunto com este filtro em ${formatarMes(estado.mes)}`
              : "Ainda não há placas para acompanhar"
          }
          descricao={
            filtrada
              ? "Nenhum conjunto combina com a busca e os filtros escolhidos. Limpe os filtros para ver a grade inteira."
              : "Quando houver placas na sua visão (carteira, operação ou filial), elas aparecem aqui, uma linha por conjunto."
          }
          {...(filtrada ? { hrefLimpar: limpar } : {})}
        />
      ) : (
        <ProvedorDoUsuario usuario={sessao.usuarioId}>
          <GradeDosConjuntos
            grade={grade}
            densidadeInicial={densidade}
            vazioDosConjuntos={
              grade.total === 0 ? (
                <ListaVazia
                  titulo={
                    filtrada
                      ? `Nenhum conjunto com este filtro em ${formatarMes(estado.mes)}`
                      : "Nenhum conjunto montado ainda"
                  }
                  descricao="Implemento solto, apoio e equipamento aparecem em Fora de conjunto, logo abaixo."
                  {...(filtrada ? { hrefLimpar: limpar } : {})}
                />
              ) : null
            }
            aposOsConjuntos={<PaginadorDosConjuntos estado={estado} grade={grade} hoje={hoje} />}
            aposOFora={<PaginadorDoFora estado={estado} grade={grade} hoje={hoje} />}
          />
        </ProvedorDoUsuario>
      )}
    </>
  );
}
