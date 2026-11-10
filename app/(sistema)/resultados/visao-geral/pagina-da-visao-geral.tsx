import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { formatarMes } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import { formatarMoeda } from "@/components/formato/moeda-valor";
import { formatarInteiro, formatarPercentual } from "@/components/formato/numero";
import { Grafico } from "@/components/grafico/grafico";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerVisaoGeral as lerDoBanco } from "@/lib/dados/visao-geral";
import type { ValoresDoResultado, VisaoGeralDosResultados } from "@/lib/dados/visao-geral-tipos";
import { acharTela } from "@/lib/navegacao/catalogo";
import {
  AGRUPAMENTOS_DA_VISAO_GERAL,
  enderecoDaVisaoGeral,
  type EstadoDaVisaoGeral,
  lerVisaoGeral,
  NOMES_DOS_AGRUPAMENTOS_DA_VISAO_GERAL,
  ROTA_DA_VISAO_GERAL,
} from "@/lib/navegacao/visao-geral";
import { cn } from "@/lib/utils";

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

function cabecalho() {
  const tela = acharTela(ROTA_DA_VISAO_GERAL)?.tela;
  return { titulo: tela?.nome ?? "Visão geral", descricao: tela?.descricao };
}

function paraParametros(bruto: Record<string, string | string[] | undefined>): URLSearchParams {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(bruto)) {
    const primeiro = Array.isArray(valor) ? valor[0] : valor;
    if (primeiro !== undefined) parametros.set(chave, primeiro);
  }
  return parametros;
}

const classeDoLink =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";
const classeDoCampo = "border-input bg-card h-9 rounded-lg border px-2";
const celula = "px-3 py-2";
const numeroNaCelula = "px-3 py-2 text-right tabular-nums";

/** O contexto global (período, filial, operação): um formulário GET, para ficar na URL. */
function Contexto({ estado, v }: { estado: EstadoDaVisaoGeral; v: VisaoGeralDosResultados }) {
  const meses = v.meses.includes(v.mes) ? v.meses : [v.mes, ...v.meses];
  return (
    <form
      method="get"
      action={ROTA_DA_VISAO_GERAL}
      className="flex flex-wrap items-end gap-3"
      role="search"
      aria-label="Contexto"
    >
      {estado.agrupamento !== "operacao" ? (
        <input type="hidden" name="por" value={estado.agrupamento} />
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Período</span>
        <select name="periodo" defaultValue={v.mes} className={classeDoCampo}>
          {meses.map((m) => (
            <option key={m} value={m}>
              {formatarMes(m)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Filial</span>
        <select name="filial" defaultValue={estado.filial ?? ""} className={classeDoCampo}>
          <option value="">Todas as filiais</option>
          {v.opcoes.filiais.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Operação</span>
        <select name="operacao" defaultValue={estado.operacao ?? ""} className={classeDoCampo}>
          <option value="">Todas as operações</option>
          {v.opcoes.operacoes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={classeDoLink}>
        Aplicar
      </button>
    </form>
  );
}

function Secao({
  id,
  titulo,
  descricao,
  children,
}: {
  id: string;
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="border-border bg-card flex flex-col gap-4 rounded-xl border p-4"
    >
      <header className="flex flex-col gap-1">
        <h2 id={id} className="text-lg font-semibold">
          {titulo}
        </h2>
        <p className="text-muted-foreground text-sm">{descricao}</p>
      </header>
      {children}
    </section>
  );
}

function PorMes({ v }: { v: VisaoGeralDosResultados }) {
  return (
    <Secao
      id="por-mes"
      titulo="Resultado por mês"
      descricao="Os 12 meses até o período, pela competência gerencial: receita, custo e o resultado de cada mês."
    >
      <Grafico
        rotulo="Receita, custo e resultado nos últimos 12 meses"
        altura={300}
        categorias={v.serie.map((s) => formatarMes(s.mes))}
        formatos={["moeda"]}
        series={[
          {
            nome: "Receita",
            tipo: "barra",
            cor: { modulo: "resultados" },
            valores: v.serie.map((s) => s.receita),
          },
          {
            nome: "Custo",
            tipo: "barra",
            cor: { modulo: "cadastros" },
            valores: v.serie.map((s) => s.custo),
          },
          {
            nome: "Resultado",
            tipo: "linha",
            cor: "acao",
            valores: v.serie.map((s) => s.resultado),
          },
        ]}
      />
    </Secao>
  );
}

function LinhaDeValores({
  rotulo,
  valores,
  total = false,
}: {
  rotulo: string;
  valores: ValoresDoResultado;
  total?: boolean;
}) {
  return (
    <tr className={cn("border-border border-t", total && "font-semibold")}>
      <th scope="row" className={cn(celula, "bg-card sticky left-0 text-left font-medium")}>
        {rotulo}
      </th>
      <td className={numeroNaCelula}>
        <Moeda valor={valores.receita} />
      </td>
      <td className={numeroNaCelula}>
        <Moeda valor={valores.custo} />
      </td>
      <td className={numeroNaCelula}>
        <Moeda valor={valores.resultado} />
      </td>
      <td className={numeroNaCelula}>{formatarPercentual(valores.margem)}</td>
    </tr>
  );
}

function PorGrupo({ v, estado }: { v: VisaoGeralDosResultados; estado: EstadoDaVisaoGeral }) {
  const nome = NOMES_DOS_AGRUPAMENTOS_DA_VISAO_GERAL[estado.agrupamento];
  return (
    <Secao
      id="por-grupo"
      titulo={`Resultado do mês por ${nome.toLowerCase()}`}
      descricao="Pelo CR de cada lançamento: a operação, a unidade gerencial ou a filial (a garagem) do CR. Lançamento de CR que o Eixo ainda não conhece fica sem operação."
    >
      <nav aria-label="Agrupar por" className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Agrupar por</span>
        {AGRUPAMENTOS_DA_VISAO_GERAL.map((g) => (
          <Link
            key={g}
            href={enderecoDaVisaoGeral({ ...estado, mes: v.mes, agrupamento: g })}
            aria-current={estado.agrupamento === g ? "page" : undefined}
            className={cn(
              classeDoLink,
              estado.agrupamento === g && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {NOMES_DOS_AGRUPAMENTOS_DA_VISAO_GERAL[g]}
          </Link>
        ))}
      </nav>
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm" data-testid="tabela-por-grupo">
          <caption className="sr-only">Resultado do mês por {nome.toLowerCase()}</caption>
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th
                scope="col"
                className={cn(celula, "sticky left-0 bg-inherit text-left font-medium")}
              >
                {nome}
              </th>
              <th scope="col" className={cn(celula, "text-right font-medium")}>
                Receita
              </th>
              <th scope="col" className={cn(celula, "text-right font-medium")}>
                Custo
              </th>
              <th scope="col" className={cn(celula, "text-right font-medium")}>
                Resultado
              </th>
              <th scope="col" className={cn(celula, "text-right font-medium")}>
                Margem
              </th>
            </tr>
          </thead>
          <tbody>
            {v.grupos.map((g) => (
              <LinhaDeValores
                key={`${g.chave ?? "sem"}-${g.rotulo}`}
                rotulo={g.rotulo}
                valores={g}
              />
            ))}
          </tbody>
          <tfoot className="border-border border-t">
            <LinhaDeValores rotulo="Total" valores={v.total} total />
          </tfoot>
        </table>
      </div>
    </Secao>
  );
}

function PorNatureza({ v }: { v: VisaoGeralDosResultados }) {
  return (
    <Secao
      id="por-natureza"
      titulo="Custo do mês por natureza"
      descricao={`As ${formatarInteiro(v.naturezas.length)} naturezas de maior custo no mês; as demais somadas em "Outras naturezas".`}
    >
      {v.naturezas.length === 0 ? (
        <ListaVazia
          titulo="Nenhum custo no mês"
          descricao="Quando houver despesas nesta competência, as naturezas de maior custo aparecem aqui."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Grafico
            rotulo="Custo do mês pelas naturezas de maior custo"
            deitado
            altura={Math.max(160, 32 * v.naturezas.length + 60)}
            categorias={v.naturezas.map((n) => n.descricao)}
            formatos={["moeda"]}
            series={[
              {
                nome: "Custo",
                tipo: "barra",
                cor: { modulo: "resultados" },
                valores: v.naturezas.map((n) => n.valor),
              },
            ]}
          />
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm" data-testid="tabela-por-natureza">
              <caption className="sr-only">Custo do mês por natureza</caption>
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th
                    scope="col"
                    className={cn(celula, "sticky left-0 bg-inherit text-left font-medium")}
                  >
                    Natureza
                  </th>
                  <th scope="col" className={cn(celula, "text-right font-medium")}>
                    Custo
                  </th>
                  <th scope="col" className={cn(celula, "text-right font-medium")}>
                    Do custo do mês
                  </th>
                </tr>
              </thead>
              <tbody>
                {v.naturezas.map((n) => (
                  <tr key={n.codnat ?? "sem"} className="border-border border-t">
                    <th
                      scope="row"
                      className={cn(celula, "bg-card sticky left-0 text-left font-medium")}
                    >
                      {n.descricao}
                    </th>
                    <td className={numeroNaCelula}>
                      <Moeda valor={n.valor} />
                    </td>
                    <td className={numeroNaCelula}>{formatarPercentual(n.participacao)}</td>
                  </tr>
                ))}
                {v.outras.naturezas > 0 ? (
                  <tr className="border-border border-t">
                    <th
                      scope="row"
                      className={cn(celula, "bg-card sticky left-0 text-left font-medium")}
                    >
                      Outras naturezas ({formatarInteiro(v.outras.naturezas)})
                    </th>
                    <td className={numeroNaCelula}>
                      <Moeda valor={v.outras.valor} />
                    </td>
                    <td className={numeroNaCelula}>{formatarPercentual(v.outras.participacao)}</td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot className="border-border border-t font-semibold">
                <tr>
                  <th scope="row" className={cn(celula, "bg-card sticky left-0 text-left")}>
                    Total
                  </th>
                  <td className={numeroNaCelula}>
                    <Moeda valor={v.total.custo} />
                  </td>
                  <td className={numeroNaCelula}>
                    {formatarPercentual(v.total.custo > 0 ? 100 : null)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </Secao>
  );
}

function Avisos({ v }: { v: VisaoGeralDosResultados }) {
  const { mudaramDeMes, semDtentsai, semCr } = v.kpis;
  const itens = [
    mudaramDeMes.lancamentos > 0
      ? `${formatarInteiro(mudaramDeMes.lancamentos)} lançamentos mudaram de mês pelo corte do dia ${formatarInteiro(v.diaDoCorte)} (${formatarMoeda(mudaramDeMes.valor)}).`
      : null,
    semDtentsai.lancamentos > 0
      ? `${formatarInteiro(semDtentsai.lancamentos)} despesas sem data de lançamento ficaram no mês da negociação (${formatarMoeda(semDtentsai.valor)}).`
      : null,
    semCr.lancamentos > 0
      ? `${formatarInteiro(semCr.lancamentos)} lançamentos de CR que o Eixo ainda não conhece (${formatarMoeda(semCr.valor)}): entram no total, sem operação.`
      : null,
  ].filter((t): t is string => t !== null);
  if (itens.length === 0) return null;
  return (
    <ul
      aria-label="Avisos da competência"
      className="text-muted-foreground flex flex-col gap-1 text-sm"
    >
      {itens.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

async function Conteudo({ estado }: { estado: EstadoDaVisaoGeral }) {
  const v = await lerDoBanco(estado);
  const comFiltro = estado.filial !== null || estado.operacao !== null;
  const semNada = v.meses.length === 0;
  const mesVazio = v.total.receita === 0 && v.total.custo === 0;
  return (
    <>
      <Contexto estado={estado} v={v} />
      <FaixaDeKpis
        kpis={[
          {
            id: "receita",
            rotulo: `Receita de ${formatarMes(v.mes)}`,
            valor: <Moeda valor={v.kpis.receita} className="text-left" />,
          },
          {
            id: "custo",
            rotulo: "Custo",
            valor: <Moeda valor={v.kpis.custo} className="text-left" />,
          },
          {
            id: "resultado",
            rotulo: "Resultado",
            valor: <Moeda valor={v.kpis.resultado} className="text-left" />,
          },
          {
            id: "margem",
            rotulo: "Margem",
            valor: formatarPercentual(v.kpis.margem),
            apoio: "Resultado sobre a receita",
          },
        ]}
      />
      <Avisos v={v} />
      {semNada ? (
        <ListaVazia
          titulo="Ainda não há lançamentos"
          descricao="Quando as receitas e as despesas do Sankhya chegarem, o resultado do mês aparece aqui."
        />
      ) : mesVazio ? (
        <ListaVazia
          titulo={comFiltro ? "Nenhum lançamento neste contexto" : "Nenhum lançamento neste mês"}
          descricao={
            comFiltro
              ? "Nenhuma receita nem despesa combina com a filial e a operação escolhidas. Limpe o contexto para ver a empresa inteira."
              : "Escolha outro período para ver o resultado."
          }
          {...(comFiltro
            ? { hrefLimpar: enderecoDaVisaoGeral({ ...estado, filial: null, operacao: null }) }
            : {})}
        />
      ) : (
        <>
          <PorMes v={v} />
          <PorGrupo v={v} estado={estado} />
          <PorNatureza v={v} />
        </>
      )}
    </>
  );
}

export function PaginaDaVisaoGeralCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo="Carregando a visão geral" />
    </PaginaDeLeitura>
  );
}

export async function PaginaDaVisaoGeral({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const estado = lerVisaoGeral(paraParametros(await searchParams));
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      {modoDosDados() !== "banco" ? (
        <ListaVazia
          titulo="A Visão geral lê só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para ver o resultado do mês."
        />
      ) : (
        <Conteudo estado={estado} />
      )}
    </PaginaDeLeitura>
  );
}
