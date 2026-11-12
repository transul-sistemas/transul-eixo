import { cookies } from "next/headers";
import { SeletorDeTamanho } from "@/components/tabela/seletor-de-tamanho";
import {
  lerTamanhoLembrado,
  NOME_DO_COOKIE_DO_TAMANHO,
  TAMANHOS_DE_PAGINA,
} from "@/lib/navegacao/preferencias-da-tabela";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { formatarData, formatarMes, hojeEmSaoPaulo } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { Etiqueta } from "@/components/etiqueta";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { BotaoDaLegenda } from "@/components/legenda/faixa-de-legenda";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { lerAgora, lerCenso, lerGrade, type LinhaDoAgora } from "@/lib/dados/acompanhamento";
import { modoDosDados } from "@/lib/dados/fonte";
import { NOMES_DOS_TIPOS, TIPOS_DE_ATIVO } from "@/lib/dados/placas-tipos";
import { NOMES_DOS_CHIPS } from "@/lib/dominio/status";
import {
  AGRUPAMENTOS,
  enderecoDoAcompanhamento,
  type EstadoDoAcompanhamento,
  lerAcompanhamento,
  TAMANHO_PADRAO_DA_GRADE,
  mesVizinho,
  NOMES_DOS_AGRUPAMENTOS,
} from "@/lib/navegacao/acompanhamento";
import { acharTela } from "@/lib/navegacao/catalogo";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { cn } from "@/lib/utils";
import { STATUS, type Status } from "@/lib/visual/tons";
import { GradeDoMes } from "./grade-do-mes";

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

const ROTA = "/frota/acompanhamento";

function cabecalho() {
  const tela = acharTela(ROTA)?.tela;
  return { titulo: tela?.nome ?? "Acompanhamento", descricao: tela?.descricao };
}

function paraParametros(bruto: Record<string, string | string[] | undefined>): URLSearchParams {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(bruto)) {
    const primeiro = Array.isArray(valor) ? valor[0] : valor;
    if (primeiro !== undefined) parametros.set(chave, primeiro);
  }
  return parametros;
}

const NOMES_DOS_MODOS = { grade: "Grade", agora: "Agora", censo: "Censo", mapa: "Mapa" } as const;

const classeDoLink =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";

function Abas({ estado, hoje }: { estado: EstadoDoAcompanhamento; hoje: string }) {
  return (
    <nav aria-label="Modos do Acompanhamento" className="flex flex-wrap gap-2">
      {(Object.keys(NOMES_DOS_MODOS) as (keyof typeof NOMES_DOS_MODOS)[]).map((modo) => (
        <Link
          key={modo}
          href={enderecoDoAcompanhamento({ ...estado, modo, pagina: 1 }, hoje)}
          aria-current={estado.modo === modo ? "page" : undefined}
          className={cn(
            classeDoLink,
            estado.modo === modo && "bg-primary text-primary-foreground hover:bg-primary",
          )}
        >
          {NOMES_DOS_MODOS[modo]}
        </Link>
      ))}
    </nav>
  );
}

/** O filtro de tipo e a busca: um formulário GET, para o estado ficar na URL. */
function Filtros({
  estado,
  comBusca,
  extra,
}: {
  estado: EstadoDoAcompanhamento;
  comBusca: boolean;
  extra?: ReactNode;
}) {
  return (
    <form method="get" action={ROTA} className="flex flex-wrap items-end gap-3" role="search">
      <input type="hidden" name="modo" value={estado.modo} />
      {estado.modo === "grade" ? <input type="hidden" name="mes" value={estado.mes} /> : null}
      {estado.modo === "agora" ? (
        <input type="hidden" name="por" value={estado.agrupamento} />
      ) : null}
      {comBusca ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Buscar placa</span>
          <input
            type="search"
            name="busca"
            defaultValue={estado.busca}
            className="border-input bg-card h-9 w-48 rounded-lg border px-3"
          />
        </label>
      ) : null}
      {extra}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Tipo de ativo</span>
        <select
          name="tipo"
          defaultValue={estado.tipo ?? ""}
          className="border-input bg-card h-9 rounded-lg border px-2"
        >
          <option value="">Todos</option>
          {TIPOS_DE_ATIVO.map((t) => (
            <option key={t} value={t}>
              {NOMES_DOS_TIPOS[t]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={classeDoLink}>
        Filtrar
      </button>
    </form>
  );
}

async function ModoGrade({ estado, hoje }: { estado: EstadoDoAcompanhamento; hoje: string }) {
  // O assistente "Lançar situação" guarda o rascunho pelo usuário da sessão (ProvedorDoUsuario).
  const [grade, sessao] = await Promise.all([lerGrade(estado), exigirSessao()]);
  const mesAtual = hoje.slice(0, 7);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2" aria-label="Mês da grade">
          <Link
            className={classeDoLink}
            href={enderecoDoAcompanhamento(
              { ...estado, mes: mesVizinho(estado.mes, -1), pagina: 1 },
              hoje,
            )}
          >
            Mês anterior
          </Link>
          <span
            className="min-w-20 text-center font-semibold tabular-nums"
            data-testid="mes-da-grade"
          >
            {formatarMes(estado.mes)}
          </span>
          {estado.mes < mesAtual ? (
            <Link
              className={classeDoLink}
              href={enderecoDoAcompanhamento(
                { ...estado, mes: mesVizinho(estado.mes, 1), pagina: 1 },
                hoje,
              )}
            >
              Próximo mês
            </Link>
          ) : null}
        </div>
        <Filtros estado={estado} comBusca />
      </div>
      {grade.total === 0 ? (
        <ListaVazia
          titulo={
            estado.busca || estado.tipo
              ? "Nenhuma placa encontrada"
              : "Ainda não há placas para acompanhar"
          }
          descricao={
            estado.busca || estado.tipo
              ? "Nenhuma placa combina com a busca e o tipo escolhidos. Limpe os filtros para ver a grade inteira."
              : "Quando houver placas na sua visão (carteira, operação ou filial), elas aparecem aqui, uma por linha."
          }
          {...(estado.busca || estado.tipo
            ? {
                hrefLimpar: enderecoDoAcompanhamento(
                  { ...estado, busca: "", tipo: null, pagina: 1 },
                  hoje,
                ),
              }
            : {})}
        />
      ) : (
        <ProvedorDoUsuario usuario={sessao.usuarioId}>
          <GradeDoMes grade={grade} />
        </ProvedorDoUsuario>
      )}
      <nav aria-label="Páginas da grade" className="flex flex-wrap items-center gap-3 text-sm">
        <span data-testid="total-da-grade" className="text-muted-foreground">
          {formatarInteiro(grade.total)} placas · página {formatarInteiro(grade.pagina)} de{" "}
          {formatarInteiro(grade.paginas)}
        </span>
        <SeletorDeTamanho
          tam={estado.tam}
          enderecos={Object.fromEntries(
            TAMANHOS_DE_PAGINA.map((t) => [
              t,
              enderecoDoAcompanhamento({ ...estado, tam: t, pagina: 1 }, hoje),
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
    </>
  );
}

const COLUNAS_DO_AGORA = [...STATUS, "pendente"] as const;
type ColunaDoAgora = (typeof COLUNAS_DO_AGORA)[number];

function contagem(linha: LinhaDoAgora, coluna: ColunaDoAgora): number {
  return coluna === "em-atividade" ? linha.emAtividade : linha[coluna];
}

async function ModoAgora({ estado, hoje }: { estado: EstadoDoAcompanhamento; hoje: string }) {
  const { grupos, total } = await lerAgora(estado.agrupamento, estado.tipo);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <nav aria-label="Agrupar por" className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">Agrupar por</span>
          {AGRUPAMENTOS.map((a) => (
            <Link
              key={a}
              href={enderecoDoAcompanhamento({ ...estado, agrupamento: a }, hoje)}
              aria-current={estado.agrupamento === a ? "page" : undefined}
              className={cn(
                classeDoLink,
                estado.agrupamento === a && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {NOMES_DOS_AGRUPAMENTOS[a]}
            </Link>
          ))}
        </nav>
        <Filtros estado={estado} comBusca={false} />
      </div>
      <FaixaDeKpis
        kpis={[
          { id: "total", rotulo: "Placas na visão", valor: formatarInteiro(total.total) },
          ...STATUS.map((s) => ({
            id: s,
            rotulo: NOMES_DOS_CHIPS[s],
            valor: formatarInteiro(s === "em-atividade" ? total.emAtividade : total[s]),
          })),
        ]}
      />
      {total.total === 0 ? (
        <ListaVazia
          titulo="Nenhuma placa na sua visão"
          descricao="Quando houver placas na sua carteira, operação ou filial, a situação de agora aparece aqui, agrupada."
        />
      ) : (
        <div className="border-border bg-card relative overflow-x-auto rounded-xl border">
          <table className="w-full text-sm" data-testid="tabela-do-agora">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 bg-inherit px-3 py-2 text-left font-medium"
                >
                  {NOMES_DOS_AGRUPAMENTOS[estado.agrupamento]}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Total
                </th>
                {COLUNAS_DO_AGORA.map((r) => (
                  <th key={r} scope="col" className="px-3 py-2 text-right font-medium">
                    {r === "pendente" ? "Pendente" : NOMES_DOS_CHIPS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={`${g.chave ?? "sem"}-${g.rotulo}`} className="border-border border-t">
                  <th scope="row" className="bg-card sticky left-0 px-3 py-2 text-left font-medium">
                    {estado.agrupamento === "tipo" && g.chave
                      ? (NOMES_DOS_TIPOS[g.chave as keyof typeof NOMES_DOS_TIPOS] ?? g.rotulo)
                      : g.rotulo}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{formatarInteiro(g.total)}</td>
                  {COLUNAS_DO_AGORA.map((r) => (
                    <td key={r} className="px-3 py-2 text-right tabular-nums">
                      {formatarInteiro(contagem(g, r))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-border border-t font-semibold">
              <tr>
                <th scope="row" className="bg-card sticky left-0 px-3 py-2 text-left">
                  Total
                </th>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatarInteiro(total.total)}
                </td>
                {COLUNAS_DO_AGORA.map((r) => (
                  <td key={r} className="px-3 py-2 text-right tabular-nums">
                    {formatarInteiro(contagem(total, r))}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}

async function ModoCenso({ estado, hoje }: { estado: EstadoDoAcompanhamento; hoje: string }) {
  const { linhas, total } = await lerCenso(estado.dia, estado.tipo);
  return (
    <>
      <Filtros
        estado={estado}
        comBusca={false}
        extra={
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Dia do censo</span>
            <input
              type="date"
              name="dia"
              max={hoje}
              defaultValue={estado.dia}
              className="border-input bg-card h-9 rounded-lg border px-2"
            />
          </label>
        }
      />
      <FaixaDeKpis
        kpis={[
          {
            id: "total",
            rotulo: `Placas em ${formatarData(estado.dia)}`,
            valor: formatarInteiro(total),
            apoio: estado.dia === hoje ? "Situação de agora" : "Situação no fim do dia",
          },
        ]}
      />
      {total === 0 ? (
        <ListaVazia
          titulo="Nenhuma placa neste dia"
          descricao="Neste dia não havia placa na sua visão. Escolha outro dia ou outro tipo de ativo."
        />
      ) : (
        <div className="border-border bg-card relative overflow-x-auto rounded-xl border">
          <table className="w-full text-sm" data-testid="tabela-do-censo">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Situação
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Nome
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Placas
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.sigla} className="border-border border-t">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    <Etiqueta status={l.grupo as Status}>{l.sigla}</Etiqueta>
                  </th>
                  <td className="px-3 py-2">{l.nome}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatarInteiro(l.quantidade)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-border border-t font-semibold">
              <tr>
                <th scope="row" colSpan={2} className="px-3 py-2 text-left">
                  Total
                </th>
                <td className="px-3 py-2 text-right tabular-nums">{formatarInteiro(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}

export function PaginaDoAcompanhamentoCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo="Carregando o acompanhamento" />
    </PaginaDeLeitura>
  );
}

export async function PaginaDoAcompanhamento({
  searchParams,
}: {
  searchParams: ParametrosDaBusca;
}) {
  await connection();
  const hoje = hojeEmSaoPaulo(new Date());
  const tamLembrado = lerTamanhoLembrado(
    (await cookies()).get(NOME_DO_COOKIE_DO_TAMANHO)?.value,
    TAMANHO_PADRAO_DA_GRADE,
  );
  const estado = lerAcompanhamento(paraParametros(await searchParams), hoje, tamLembrado);
  const { titulo, descricao } = cabecalho();
  let conteudo: ReactNode;
  if (modoDosDados() !== "banco") {
    conteudo = (
      <ListaVazia
        titulo="O Acompanhamento lê só do banco"
        descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para ver a grade, o Agora e o Censo."
      />
    );
  } else if (estado.modo === "grade") {
    conteudo = <ModoGrade estado={estado} hoje={hoje} />;
  } else if (estado.modo === "agora") {
    conteudo = <ModoAgora estado={estado} hoje={hoje} />;
  } else if (estado.modo === "censo") {
    conteudo = <ModoCenso estado={estado} hoje={hoje} />;
  } else {
    conteudo = (
      <ListaVazia
        titulo="O mapa entra numa próxima versão"
        descricao="Por enquanto, acompanhe as placas pela Grade, pelo Agora e pelo Censo."
      />
    );
  }
  return (
    <PaginaDeLeitura
      titulo={titulo}
      descricao={descricao}
      acoes={<BotaoDaLegenda />}
      consulta={<Abas estado={estado} hoje={hoje} />}
    >
      {conteudo}
    </PaginaDeLeitura>
  );
}
