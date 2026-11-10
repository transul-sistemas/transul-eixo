import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";
import { connection } from "next/server";
import { formatarMes } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerEscalaDoMes } from "@/lib/dados/pessoas";
import { SIGLAS_DA_ESCALA } from "@/lib/dominio/esquemas/pessoa";
import { acharTela } from "@/lib/navegacao/catalogo";
import { enderecoDaEscala, lerEscala, mesVizinho, ROTA_DA_ESCALA } from "@/lib/navegacao/pessoas";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { paraParametros, type ParametrosDaBusca } from "../lista/pagina-de-pessoas";
import { EscolherOperacao } from "./escolher-operacao";
import { GradeDaEscala } from "./grade-da-escala";

// Pessoas › Escala (primeira versão): a grade do mês da operação escolhida (pessoas vinculadas no mês
// × dias), com a marcação de cada dia (T, F, FE, AT) lançada pelo mini-assistente "Marcar dia". A
// operação e o mês ficam na URL; o banco entrega a grade e os totais (nucleo.escala_do_mes).

function cabecalho() {
  const tela = acharTela(ROTA_DA_ESCALA)?.tela;
  return { titulo: tela?.nome ?? "Escala", descricao: tela?.descricao };
}

const CLASSE_DO_MES =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";

export function PaginaDaEscalaCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo="Carregando a escala" />
    </PaginaDeLeitura>
  );
}

async function Conteudo({ parametros }: { parametros: URLSearchParams }) {
  const sessao = await exigirSessao();
  const estado = lerEscala(parametros);
  const escala = await lerEscalaDoMes(estado);
  const { titulo, descricao } = cabecalho();
  const operacaoId = escala.operacao?.id ?? null;
  const anterior = mesVizinho(escala.mes, -1);
  const seguinte = mesVizinho(escala.mes, 1);
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <div className="flex flex-wrap items-center gap-3">
        {escala.operacoes.length > 0 ? (
          <EscolherOperacao operacoes={escala.operacoes} atual={operacaoId} mes={escala.mes} />
        ) : null}
        <nav aria-label="Mês da escala" className="flex items-center gap-2">
          <Link
            href={enderecoDaEscala(operacaoId, anterior)}
            className={CLASSE_DO_MES}
            aria-label={`Mês anterior, ${formatarMes(anterior)}`}
          >
            <IconChevronLeft aria-hidden className="size-4" />
          </Link>
          <span
            className="min-w-28 text-center text-sm font-medium tabular-nums"
            aria-live="polite"
          >
            {formatarMes(escala.mes)}
          </span>
          <Link
            href={enderecoDaEscala(operacaoId, seguinte)}
            className={CLASSE_DO_MES}
            aria-label={`Mês seguinte, ${formatarMes(seguinte)}`}
          >
            <IconChevronRight aria-hidden className="size-4" />
          </Link>
        </nav>
      </div>
      <FaixaDeKpis
        kpis={[
          {
            id: "pessoas",
            rotulo: "Pessoas na escala",
            valor: formatarInteiro(escala.totais.pessoas),
          },
          ...SIGLAS_DA_ESCALA.map((s) => ({
            id: s.id,
            rotulo: `${s.nome} (${s.id})`,
            valor: formatarInteiro(escala.totais[s.id]),
            apoio: "dias marcados no mês",
          })),
        ]}
      />
      {escala.operacao === null ? (
        <ListaVazia
          titulo="Nenhuma operação ao seu alcance"
          descricao="A escala aparece quando houver operações no catálogo de Cadastros ao seu alcance."
        />
      ) : escala.pessoas.length === 0 ? (
        <ListaVazia
          titulo={`Ninguém vinculado a ${escala.operacao.nome} em ${formatarMes(escala.mes)}`}
          descricao="Ponha pessoas nesta operação pelo assistente Cadastrar pessoa ou Editar pessoa, na lista de Pessoas, e elas aparecem aqui."
        />
      ) : (
        <GradeDaEscala escala={escala} usuario={sessao.usuarioId} />
      )}
      {!escala.podeMarcar && escala.pessoas.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          Seu perfil vê esta escala, mas não marca os dias.
        </p>
      ) : null}
    </PaginaDeLeitura>
  );
}

export async function PaginaDaEscala({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const parametros = paraParametros(await searchParams);
  if (modoDosDados() !== "banco") {
    const { titulo, descricao } = cabecalho();
    return (
      <PaginaDeLeitura titulo={titulo} descricao={descricao}>
        <ListaVazia
          titulo="A Escala lê só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para montar a escala do mês."
        />
      </PaginaDeLeitura>
    );
  }
  return <Conteudo parametros={parametros} />;
}
