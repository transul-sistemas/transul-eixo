import Link from "next/link";
import { formatarData, formatarMes } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { ListaVazia } from "@/components/tabela/estados";
import { SeletorDeTamanho } from "@/components/tabela/seletor-de-tamanho";
import {
  type ChipsDaGrade,
  type FiltrosDaGrade,
  lerGradeDeSoltas,
  lerGradePorConjunto,
} from "@/lib/dados/acompanhamento";
import type { ClienteDeEscrita } from "@/lib/dados/escrita-do-banco";
import { lerSituacoesProgramadas, type SituacaoProgramada } from "@/lib/dados/lancar-o-dia";
import { diasDoMes, medidaDoDia, tamanhoEfetivoDaPagina } from "@/lib/dominio/grade-por-conjunto";
import { textoDoErro } from "@/lib/log/erro";
import { NOMES_DOS_CHIPS } from "@/lib/dominio/status";
import {
  enderecoDoAcompanhamento,
  type EstadoDoAcompanhamento,
  mesVizinho,
  TIPOS_DE_CR_DA_GRADE,
} from "@/lib/navegacao/acompanhamento";
import {
  type Densidade,
  NOME_DO_COOKIE_DO_TAMANHO_DA_GRADE,
} from "@/lib/navegacao/preferencias-da-tabela";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { cn } from "@/lib/utils";
import { STATUS, variavelDoStatus } from "@/lib/visual/tons";
import { AjusteDeLinhas } from "./ajuste-de-linhas";
import { GradeDeSoltas, GradeDosConjuntos } from "./grade-por-conjunto";

// O modo Grade do Acompanhamento, em duas abas (A1): Conjuntos (cavalo com ou sem implemento e caminhão) e
// Soltas (implemento sem cavalo engatado, apoio e equipamento). Cada aba tem a sua faixa do dia ("X de Y
// conjuntos com lançamento hoje" ou "X de Y soltas com situação hoje"), os chips de situação com contagem,
// o mês, a busca e a grade. X, Y, o total e a contagem dos chips vêm do banco.

const ROTA = "/frota/acompanhamento";
const NOMES_DOS_TIPOS_DE_CR = { frota: "Frota", acionista: "Acionista" } as const;

const classeDoLink =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";

const classeDoChip =
  "focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm outline-none focus-visible:ring-3";

const chipLigado = "bg-primary text-primary-foreground border-primary";
const chipDesligado = "border-input bg-card hover:bg-muted";

/** O que as duas abas têm em comum na tela (tudo isto vem do banco). */
interface ResumoDaAba {
  mes: string;
  hoje: string;
  total: number;
  pagina: number;
  paginas: number;
  chips: ChipsDaGrade;
  medida: { x: number; y: number };
}

/** A faixa do dia: "X de Y ... hoje" (X e Y vêm do banco) e a barra de progresso. */
function FaixaDoDia({ resumo, soltas }: { resumo: ResumoDaAba; soltas: boolean }) {
  const medida = medidaDoDia(resumo.medida.x, resumo.medida.y);
  const quais = soltas ? "soltas com situação hoje" : "conjuntos com lançamento hoje";
  return (
    <section
      aria-label="Hoje"
      data-testid="faixa-do-dia"
      className="border-border bg-card flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border px-4 py-2"
    >
      <span className="text-base font-semibold">Hoje, {formatarData(resumo.hoje)}</span>
      {medida.tipo === "vazia" ? (
        <span className="text-muted-foreground text-sm" data-testid="x-de-y">
          {soltas
            ? "Sem dados ainda: depende de placas soltas ativas no dia"
            : "Sem dados ainda: depende de conjuntos ativos no dia"}
        </span>
      ) : (
        <>
          <span className="text-muted-foreground text-sm" data-testid="x-de-y">
            <b className="text-foreground tabular-nums">
              {formatarInteiro(medida.x)} de {formatarInteiro(medida.y)}
            </b>{" "}
            {quais}
          </span>
          <progress
            value={medida.x}
            max={medida.y}
            aria-label={soltas ? "Soltas com situação hoje" : "Conjuntos com lançamento hoje"}
            className="h-2 w-44 overflow-hidden rounded-full [&::-moz-progress-bar]:bg-[var(--acao)] [&::-webkit-progress-bar]:bg-[var(--linha)] [&::-webkit-progress-value]:bg-[var(--acao)]"
          />
        </>
      )}
    </section>
  );
}

/** Os chips da régua com a contagem por grupo (do banco) e o tipo do CR; cada um filtra a grade pela URL. */
function ChipsDaAba({
  estado,
  chips,
  hoje,
}: {
  estado: EstadoDoAcompanhamento;
  chips: ChipsDaGrade;
  hoje: string;
}) {
  const ir = (mudanca: Partial<EstadoDoAcompanhamento>) =>
    enderecoDoAcompanhamento({ ...estado, ...mudanca, pagina: 1 }, hoje);
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="chips-da-grade">
      <nav aria-label="Situação" className="flex flex-wrap items-center gap-2">
        <Link
          href={ir({ grupo: null })}
          aria-current={estado.grupo === null ? "true" : undefined}
          className={cn(classeDoChip, estado.grupo === null ? chipLigado : chipDesligado)}
        >
          Todos <b className="tabular-nums">{formatarInteiro(chips.todos)}</b>
        </Link>
        {STATUS.map((g) => {
          const quantidade = chips[g];
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

/** O mês e a busca: a busca é um formulário GET (placa do cavalo ou do implemento), o estado fica na URL. */
function MesEBusca({ estado, hoje }: { estado: EstadoDoAcompanhamento; hoje: string }) {
  const mesAtual = hoje.slice(0, 7);
  const mes = (passo: -1 | 1) =>
    enderecoDoAcompanhamento({ ...estado, mes: mesVizinho(estado.mes, passo), pagina: 1 }, hoje);
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
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
      <form method="get" action={ROTA} className="flex items-end gap-2" role="search">
        <input type="hidden" name="modo" value={estado.modo} />
        <input type="hidden" name="mes" value={estado.mes} />
        {estado.grupo ? <input type="hidden" name="chip" value={estado.grupo} /> : null}
        {estado.tipoDeCr ? <input type="hidden" name="cr" value={estado.tipoDeCr} /> : null}
        {estado.foco ? <input type="hidden" name="foco" value="1" /> : null}
        {estado.tam !== "auto" ? (
          <input type="hidden" name="tam" value={String(estado.tam)} />
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Buscar placa</span>
          <input
            type="search"
            name="busca"
            defaultValue={estado.busca}
            className="border-input bg-card h-9 w-44 rounded-lg border px-3"
          />
        </label>
        <button type="submit" className={classeDoLink}>
          Buscar
        </button>
      </form>
    </div>
  );
}

function Paginador({
  estado,
  resumo,
  hoje,
  linhasPorPagina,
  unidade,
}: {
  estado: EstadoDoAcompanhamento;
  resumo: ResumoDaAba;
  hoje: string;
  /** Quantas linhas a página tem (o Auto calcula pela janela). */
  linhasPorPagina: number;
  unidade: string;
}) {
  const ir = (pagina: number) => enderecoDoAcompanhamento({ ...estado, pagina }, hoje);
  const opcoes: ("auto" | 20 | 50 | 100)[] = ["auto", 20, 50, 100];
  return (
    <nav aria-label={`Páginas de ${unidade}`} className="flex flex-wrap items-center gap-3 text-sm">
      <span data-testid="total-da-grade" className="text-muted-foreground">
        {formatarInteiro(resumo.total)} {unidade} · página {formatarInteiro(resumo.pagina)} de{" "}
        {formatarInteiro(resumo.paginas)}
        {estado.tam === "auto" ? ` · ${formatarInteiro(linhasPorPagina)} por página (Auto)` : ""}
      </span>
      <SeletorDeTamanho
        tam={estado.tam}
        cookie={NOME_DO_COOKIE_DO_TAMANHO_DA_GRADE}
        enderecos={Object.fromEntries(
          opcoes.map((t) => [
            String(t),
            enderecoDoAcompanhamento({ ...estado, tam: t, pagina: 1 }, hoje),
          ]),
        )}
      />
      {resumo.pagina > 1 ? (
        <Link className={classeDoLink} href={ir(resumo.pagina - 1)}>
          Página anterior
        </Link>
      ) : null}
      {resumo.pagina < resumo.paginas ? (
        <Link className={classeDoLink} href={ir(resumo.pagina + 1)}>
          Próxima página
        </Link>
      ) : null}
    </nav>
  );
}

/** A2: as situações programadas do mês; falha não derruba a grade (vira lista vazia, com o log). */
async function programadasDoMes(mes: string, hoje: string): Promise<SituacaoProgramada[]> {
  const dias = diasDoMes(mes, hoje);
  const de = dias[0]?.dia;
  const ate = dias.at(-1)?.dia;
  if (!de || !ate) return [];
  try {
    const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeEscrita;
    return await lerSituacoesProgramadas(cliente, de, ate);
  } catch (erro) {
    console.error("situações programadas indisponíveis:", textoDoErro(erro));
    return [];
  }
}

export async function ModoGrade({
  estado,
  hoje,
  densidade,
  alturaDaJanela,
}: {
  estado: EstadoDoAcompanhamento;
  hoje: string;
  densidade: Densidade;
  alturaDaJanela: number;
}) {
  const soltas = estado.modo === "soltas";
  // Auto: quantas linhas cabem na altura da janela (a página nunca rola na vertical).
  const linhasPorPagina = tamanhoEfetivoDaPagina(estado.tam, alturaDaJanela, densidade);
  const filtros: FiltrosDaGrade = {
    mes: estado.mes,
    busca: estado.busca,
    tipoDeCr: estado.tipoDeCr,
    grupo: estado.grupo,
    pagina: estado.pagina,
    tam: linhasPorPagina,
  };
  // O assistente "Lançar situação" guarda o rascunho pelo usuário da sessão (ProvedorDoUsuario).
  const [dados, sessao, programadas] = await Promise.all([
    soltas ? lerGradeDeSoltas(filtros) : lerGradePorConjunto(filtros),
    exigirSessao(),
    programadasDoMes(estado.mes.slice(0, 7), hoje),
  ]);
  const resumo: ResumoDaAba = {
    mes: dados.mes,
    hoje: dados.hoje,
    total: dados.total,
    pagina: dados.pagina,
    paginas: dados.paginas,
    chips: dados.chips,
    medida: "situacaoHoje" in dados ? dados.situacaoHoje : dados.lancamentoHoje,
  };
  const filtrada = Boolean(estado.busca || estado.tipoDeCr || estado.grupo);
  const limpar = enderecoDoAcompanhamento(
    { ...estado, busca: "", tipoDeCr: null, grupo: null, pagina: 1 },
    hoje,
  );
  const unidade = soltas ? "placas" : "conjuntos";
  const vazio = (
    <ListaVazia
      titulo={
        filtrada
          ? `Nenhum${soltas ? "a placa solta" : " conjunto"} com este filtro em ${formatarMes(estado.mes)}`
          : soltas
            ? "Nenhuma placa solta neste mês"
            : "Ainda não há conjuntos para acompanhar"
      }
      descricao={
        filtrada
          ? "Nada combina com a busca e os filtros escolhidos. Limpe os filtros para ver a grade inteira."
          : soltas
            ? "Implemento sem cavalo engatado, apoio e equipamento aparecem aqui, uma linha por placa."
            : "Quando houver cavalos e caminhões na sua visão (carteira, operação ou filial), eles aparecem aqui, uma linha por conjunto."
      }
      {...(filtrada ? { hrefLimpar: limpar } : {})}
    />
  );
  const paginador = (
    <Paginador
      estado={estado}
      resumo={resumo}
      hoje={hoje}
      linhasPorPagina={linhasPorPagina}
      unidade={unidade}
    />
  );
  return (
    <>
      {estado.tam === "auto" ? <AjusteDeLinhas alturaUsada={alturaDaJanela} /> : null}
      <FaixaDoDia resumo={resumo} soltas={soltas} />
      <ChipsDaAba estado={estado} chips={resumo.chips} hoje={hoje} />
      <MesEBusca estado={estado} hoje={hoje} />
      <ProvedorDoUsuario usuario={sessao.usuarioId}>
        {"situacaoHoje" in dados ? (
          <GradeDeSoltas
            grade={dados}
            densidadeInicial={densidade}
            vazio={vazio}
            paginador={paginador}
            programadas={programadas}
          />
        ) : (
          <GradeDosConjuntos
            grade={dados}
            densidadeInicial={densidade}
            vazio={vazio}
            paginador={paginador}
            programadas={programadas}
          />
        )}
      </ProvedorDoUsuario>
    </>
  );
}
