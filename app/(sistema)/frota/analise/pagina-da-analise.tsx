import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { formatarData, formatarMes, hojeEmSaoPaulo } from "@/components/formato/data";
import { formatarInteiro, formatarPercentual } from "@/components/formato/numero";
import { Grafico } from "@/components/grafico/grafico";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { Placa } from "@/components/placa";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { type AnaliseDaFrota, lerAnaliseDaFrota, lerOpcoesDaAnalise } from "@/lib/dados/analise";
import type { OpcoesDaAnalise } from "@/lib/dados/analise-tipos";
import { modoDosDados } from "@/lib/dados/fonte";
import { NOMES_DOS_TIPOS } from "@/lib/dados/placas-tipos";
import { NOMES_DOS_CHIPS } from "@/lib/dominio/status";
import {
  AGRUPAMENTOS_DA_ANALISE,
  enderecoDaAnalise,
  type EstadoDaAnalise,
  lerAnalise,
  NOMES_DOS_AGRUPAMENTOS_DA_ANALISE,
} from "@/lib/navegacao/analise";
import { acharTela } from "@/lib/navegacao/catalogo";
import { cn } from "@/lib/utils";

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

const ROTA = "/frota/analise";

function cabecalho() {
  const tela = acharTela(ROTA)?.tela;
  return { titulo: tela?.nome ?? "Análise", descricao: tela?.descricao };
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

/** O contexto global da Análise (período, filial, operação): um formulário GET, para ficar na URL. */
function Contexto({
  estado,
  opcoes,
  hoje,
}: {
  estado: EstadoDaAnalise;
  opcoes: OpcoesDaAnalise;
  hoje: string;
}) {
  return (
    <form method="get" action={ROTA} className="flex flex-wrap items-end gap-3" role="search">
      {estado.agrupamento !== "operacao" ? (
        <input type="hidden" name="por" value={estado.agrupamento} />
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Período</span>
        <input
          type="month"
          name="periodo"
          max={hoje.slice(0, 7)}
          defaultValue={estado.mes}
          className={classeDoCampo}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Filial</span>
        <select name="filial" defaultValue={estado.filial ?? ""} className={classeDoCampo}>
          <option value="">Todas as filiais</option>
          {opcoes.filiais.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Operação</span>
        <select name="operacao" defaultValue={estado.operacao ?? ""} className={classeDoCampo}>
          <option value="">Todas as operações</option>
          {opcoes.operacoes.map((o) => (
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

function Camada({
  numero,
  titulo,
  descricao,
  children,
}: {
  numero: number;
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`camada-${numero}`}
      className="border-border bg-card flex flex-col gap-4 rounded-xl border p-4"
    >
      <header className="flex flex-col gap-1">
        <h2 id={`camada-${numero}`} className="text-lg font-semibold">
          {numero}. {titulo}
        </h2>
        <p className="text-muted-foreground text-sm">{descricao}</p>
      </header>
      {children}
    </section>
  );
}

const celula = "px-3 py-2";
const numeroNaCelula = "px-3 py-2 text-right tabular-nums";

function Retrato({ a }: { a: AnaliseDaFrota }) {
  return (
    <Camada
      numero={1}
      titulo="Retrato de agora"
      descricao="Como a frota está neste momento: placas por tipo e as que estão há mais tempo paradas no pátio."
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <Grafico
          rotulo="Frota por tipo de ativo: total e em atividade agora"
          deitado
          altura={240}
          categorias={a.tipos.map((t) => NOMES_DOS_TIPOS[t.tipo])}
          formatos={["inteiro"]}
          series={[
            {
              nome: "Placas",
              tipo: "barra",
              cor: { modulo: "frota" },
              valores: a.tipos.map((t) => t.total),
            },
            {
              nome: NOMES_DOS_CHIPS["em-atividade"],
              tipo: "barra",
              cor: { status: "em-atividade" },
              valores: a.tipos.map((t) => t.emAtividade),
            },
          ]}
        />
        {a.maisTempoNoPat.length === 0 ? (
          <ListaVazia
            titulo="Nenhuma placa no pátio"
            descricao="Quando uma placa entrar em PÁT, ela aparece aqui com os dias parada."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="tabela-do-pat">
              <caption className="text-muted-foreground pb-2 text-left text-sm">
                Há mais tempo no pátio
              </caption>
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th scope="col" className={cn(celula, "text-left font-medium")}>
                    Placa
                  </th>
                  <th scope="col" className={cn(celula, "text-left font-medium")}>
                    Operação
                  </th>
                  <th scope="col" className={cn(celula, "text-left font-medium")}>
                    No pátio desde
                  </th>
                  <th scope="col" className={cn(celula, "text-right font-medium")}>
                    Dias
                  </th>
                </tr>
              </thead>
              <tbody>
                {a.maisTempoNoPat.map((p) => (
                  <tr key={p.ativoId} className="border-border border-t">
                    <th scope="row" className={cn(celula, "text-left font-medium")}>
                      <Link
                        href={`/frota/placas/${p.placa}`}
                        aria-label={`Abrir a placa ${p.placa}`}
                      >
                        <Placa placa={p.placa} tamanho="p" />
                      </Link>
                    </th>
                    <td className={celula}>{p.operacao ?? "Sem operação"}</td>
                    <td className={celula}>{formatarData(p.desde)}</td>
                    <td className={numeroNaCelula}>{formatarInteiro(p.dias)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Camada>
  );
}

function Disponibilidade({ a }: { a: AnaliseDaFrota }) {
  return (
    <Camada
      numero={2}
      titulo="Disponibilidade no mês"
      descricao="Placas em atividade sobre as placas na frota (sem as de fora), na situação do fim de cada dia. A do mês pesa cada placa por dia."
    >
      <Grafico
        rotulo="Situação da frota dia a dia e disponibilidade"
        altura={300}
        categorias={a.dias.map((d) => formatarData(d.dia).slice(0, 5))}
        formatos={["inteiro", "percentual"]}
        series={[
          {
            nome: NOMES_DOS_CHIPS["em-atividade"],
            tipo: "barra",
            pilha: "frota",
            cor: { status: "em-atividade" },
            valores: a.dias.map((d) => d.emAtividade),
          },
          {
            nome: NOMES_DOS_CHIPS.atencao,
            tipo: "barra",
            pilha: "frota",
            cor: { status: "atencao" },
            valores: a.dias.map((d) => d.atencao),
          },
          {
            nome: NOMES_DOS_CHIPS.impedida,
            tipo: "barra",
            pilha: "frota",
            cor: { status: "impedida" },
            valores: a.dias.map((d) => d.impedida),
          },
          {
            nome: NOMES_DOS_CHIPS.patio,
            tipo: "barra",
            pilha: "frota",
            cor: { status: "patio" },
            valores: a.dias.map((d) => d.patio),
          },
          {
            nome: "Disponibilidade",
            tipo: "linha",
            eixo: 1,
            cor: "acao",
            valores: a.dias.map((d) => d.disponibilidade),
          },
        ]}
      />
    </Camada>
  );
}

function Onde({ a, estado, hoje }: { a: AnaliseDaFrota; estado: EstadoDaAnalise; hoje: string }) {
  const nome = NOMES_DOS_AGRUPAMENTOS_DA_ANALISE[estado.agrupamento];
  return (
    <Camada
      numero={3}
      titulo="Onde está a diferença"
      descricao="A mesma conta por operação, filial ou gestor (o vínculo atual de cada placa)."
    >
      <nav aria-label="Agrupar por" className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Agrupar por</span>
        {AGRUPAMENTOS_DA_ANALISE.map((g) => (
          <Link
            key={g}
            href={enderecoDaAnalise({ ...estado, agrupamento: g }, hoje)}
            aria-current={estado.agrupamento === g ? "page" : undefined}
            className={cn(
              classeDoLink,
              estado.agrupamento === g && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {NOMES_DOS_AGRUPAMENTOS_DA_ANALISE[g]}
          </Link>
        ))}
      </nav>
      <div className="grid gap-4 xl:grid-cols-2">
        <Grafico
          rotulo={`Disponibilidade do mês por ${nome.toLowerCase()}`}
          deitado
          altura={Math.max(160, 36 * a.grupos.length + 60)}
          categorias={a.grupos.map((g) => g.rotulo)}
          formatos={["percentual"]}
          series={[
            {
              nome: "Disponibilidade",
              tipo: "barra",
              cor: "acao",
              valores: a.grupos.map((g) => g.disponibilidade),
            },
          ]}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="tabela-por-grupo">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th
                  scope="col"
                  className={cn(celula, "sticky left-0 bg-inherit text-left font-medium")}
                >
                  {nome}
                </th>
                <th scope="col" className={cn(celula, "text-right font-medium")}>
                  Placas agora
                </th>
                <th scope="col" className={cn(celula, "text-right font-medium")}>
                  {NOMES_DOS_CHIPS["em-atividade"]}
                </th>
                <th scope="col" className={cn(celula, "text-right font-medium")}>
                  {NOMES_DOS_CHIPS.impedida}
                </th>
                <th scope="col" className={cn(celula, "text-right font-medium")}>
                  {NOMES_DOS_CHIPS.patio}
                </th>
                <th scope="col" className={cn(celula, "text-right font-medium")}>
                  Paradas além do limite
                </th>
                <th scope="col" className={cn(celula, "text-right font-medium")}>
                  Disponibilidade
                </th>
              </tr>
            </thead>
            <tbody>
              {a.grupos.map((g) => (
                <tr key={`${g.chave ?? "sem"}-${g.rotulo}`} className="border-border border-t">
                  <th
                    scope="row"
                    className={cn(celula, "bg-card sticky left-0 text-left font-medium")}
                  >
                    {g.rotulo}
                  </th>
                  <td className={numeroNaCelula}>{formatarInteiro(g.total)}</td>
                  <td className={numeroNaCelula}>{formatarInteiro(g.emAtividade)}</td>
                  <td className={numeroNaCelula}>{formatarInteiro(g.impedida)}</td>
                  <td className={numeroNaCelula}>{formatarInteiro(g.patio)}</td>
                  <td className={numeroNaCelula}>{formatarInteiro(g.paradosNoPat)}</td>
                  <td className={numeroNaCelula}>{formatarPercentual(g.disponibilidade)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-border border-t font-semibold">
              <tr>
                <th scope="row" className={cn(celula, "bg-card sticky left-0 text-left")}>
                  Total
                </th>
                <td className={numeroNaCelula}>{formatarInteiro(a.retrato.total)}</td>
                <td className={numeroNaCelula}>{formatarInteiro(a.retrato.emAtividade)}</td>
                <td className={numeroNaCelula}>{formatarInteiro(a.retrato.impedida)}</td>
                <td className={numeroNaCelula}>{formatarInteiro(a.retrato.patio)}</td>
                <td className={numeroNaCelula}>{formatarInteiro(a.retrato.paradosNoPat)}</td>
                <td className={numeroNaCelula}>{formatarPercentual(a.disponibilidade)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Camada>
  );
}

function CustoEConsumo() {
  return (
    <Camada
      numero={4}
      titulo="Custo e consumo"
      descricao="Próxima versão: depende do abastecimento e dos títulos do Sankhya, que ainda estão chegando."
    >
      <p className="text-muted-foreground text-sm" data-testid="camada-proxima-versao">
        Esta camada vai trazer o custo por placa e por operação no mês (abastecimento, manutenção e
        demais títulos pela competência gerencial), o consumo em km/l e quanto da diferença de
        resultado se explica pela disponibilidade.
      </p>
    </Camada>
  );
}

async function Conteudo({ estado, hoje }: { estado: EstadoDaAnalise; hoje: string }) {
  const [a, opcoes] = await Promise.all([lerAnaliseDaFrota(estado), lerOpcoesDaAnalise()]);
  const comFiltro = estado.filial !== null || estado.operacao !== null;
  const vazio = a.retrato.total === 0 && a.placaDias === 0;
  return (
    <>
      <Contexto estado={estado} opcoes={opcoes} hoje={hoje} />
      <FaixaDeKpis
        kpis={[
          { id: "total", rotulo: "Placas na frota agora", valor: formatarInteiro(a.retrato.total) },
          {
            id: "em-atividade",
            rotulo: "Em atividade agora",
            valor: formatarInteiro(a.retrato.emAtividade),
          },
          {
            id: "disponibilidade",
            rotulo: `Disponibilidade em ${formatarMes(estado.mes)}`,
            valor: formatarPercentual(a.disponibilidade),
            apoio: `Até ${formatarData(a.ate)}, sobre ${formatarInteiro(a.placaDias)} placa-dias`,
          },
          {
            id: "pat",
            rotulo: "Paradas no pátio além do limite",
            valor: formatarInteiro(a.retrato.paradosNoPat),
            apoio: `${formatarInteiro(a.retrato.patio)} no pátio agora`,
          },
          {
            id: "dias-no-pat",
            rotulo: "Dias parados no pátio (média)",
            valor: formatarInteiro(a.retrato.diasMedioNoPat),
          },
        ]}
      />
      {vazio ? (
        <ListaVazia
          titulo={comFiltro ? "Nenhuma placa neste contexto" : "Ainda não há placas para analisar"}
          descricao={
            comFiltro
              ? "Nenhuma placa combina com a filial e a operação escolhidas. Limpe o contexto para ver a frota inteira."
              : "Quando houver placas na sua visão (carteira, operação ou filial), a análise aparece aqui."
          }
          {...(comFiltro
            ? {
                hrefLimpar: enderecoDaAnalise({ ...estado, filial: null, operacao: null }, hoje),
              }
            : {})}
        />
      ) : (
        <>
          <Retrato a={a} />
          <Disponibilidade a={a} />
          <Onde a={a} estado={estado} hoje={hoje} />
        </>
      )}
      <CustoEConsumo />
    </>
  );
}

export function PaginaDaAnaliseCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo="Carregando a análise" />
    </PaginaDeLeitura>
  );
}

export async function PaginaDaAnalise({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const hoje = hojeEmSaoPaulo(new Date());
  const estado = lerAnalise(paraParametros(await searchParams), hoje);
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      {modoDosDados() !== "banco" ? (
        <ListaVazia
          titulo="A Análise lê só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para ver as camadas."
        />
      ) : (
        <Conteudo estado={estado} hoje={hoje} />
      )}
    </PaginaDeLeitura>
  );
}
