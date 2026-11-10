import Link from "next/link";
import { connection } from "next/server";
import { formatarMes } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro } from "@/components/formato/numero";
import {
  BarraDeConsultaDaPagina,
  type ChipDeConsulta,
} from "@/components/layout/barra-de-consulta";
import { FaixaDeKpis, type Kpi } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerParceirosDoMes } from "@/lib/dados/parceiros";
import type { ParceirosDoMes } from "@/lib/dados/parceiros-tipos";
import { acharTela } from "@/lib/navegacao/catalogo";
import {
  CHIPS_DE_TIPO_DE_PARCEIRO,
  enderecoDaConciliacao,
  lerParceiros,
  ROTA_DOS_PARCEIROS,
} from "@/lib/navegacao/parceiros";
import { temPermissao } from "@/lib/seguranca/exigir-permissao";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import {
  paraParametros,
  type ParametrosDaBusca,
  SeletorDeMes,
} from "../../operacoes/lista/pagina-de-operacoes";
import { CadastrarParceiro } from "./cadastrar-parceiro";
import { TabelaDeParceiros } from "./tabela-de-parceiros";

export type { ParametrosDaBusca };

// Parceiros › lista (primeira versão): cada parceiro com os tipos, as placas vinculadas agora e os
// totais do mês nos CRs do agrupador do Sankhya, prontos no banco. Os números vêm do staging
// provisório (a cópia da v1) até a ponte do Sankhya.

function cabecalho() {
  const tela = acharTela(ROTA_DOS_PARCEIROS)?.tela;
  return { titulo: tela?.nome ?? "Parceiros", descricao: tela?.descricao };
}

const APRESENTACAO = {
  tipo: { titulo: "Tipo", subtitulo: "O que o parceiro é", forma: "retangulo", destaque: "escuro" },
} as const;

function Barra({ contagens }: { contagens: Record<string, number> | null }) {
  const chips: ChipDeConsulta[] = CHIPS_DE_TIPO_DE_PARCEIRO.map((c) => ({
    ...c,
    grupo: "tipo",
    contagem: contagens?.[c.id],
  }));
  return (
    <BarraDeConsultaDaPagina
      rotulo="Buscar parceiro"
      chips={chips}
      apresentacaoDosGrupos={APRESENTACAO}
    />
  );
}

function kpisDe(dados: ParceirosDoMes): Kpi[] {
  const t = dados.totais;
  return [
    { id: "parceiros", rotulo: "Parceiros", valor: formatarInteiro(t.parceiros) },
    { id: "placas", rotulo: "Placas agora", valor: formatarInteiro(t.placas) },
    { id: "despesa", rotulo: "Despesa do mês", valor: <Moeda valor={t.despesaCentavos} /> },
    { id: "receita", rotulo: "Receita do mês", valor: <Moeda valor={t.receitaCentavos} /> },
    {
      id: "locacao",
      rotulo: "Locação mensal vigente",
      valor: <Moeda valor={t.locacaoMensalCentavos} />,
    },
  ];
}

export function PaginaDeParceirosCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura
      lista
      titulo={titulo}
      descricao={descricao}
      consulta={<Barra contagens={null} />}
    >
      <EsqueletoDaTabela rotulo="Carregando os parceiros" />
    </PaginaDeLeitura>
  );
}

async function Conteudo({ parametros }: { parametros: URLSearchParams }) {
  const estado = lerParceiros(parametros);
  const [dados, sessao] = await Promise.all([lerParceirosDoMes(estado), exigirSessao()]);
  const filtrando = estado.consulta.busca !== "" || estado.consulta.chips.length > 0;
  const podeCadastrar = temPermissao(sessao.perfil, { modulo: "parceiros", acao: "criar" });
  const { titulo, descricao } = cabecalho();
  const livres = dados.agrupadoresLivres.length;
  return (
    <PaginaDeLeitura
      lista
      titulo={titulo}
      descricao={descricao}
      acoes={
        podeCadastrar ? (
          <CadastrarParceiro agrupadores={dados.agrupadoresLivres} usuario={sessao.usuarioId} />
        ) : undefined
      }
      consulta={<Barra contagens={dados.chips} />}
    >
      <SeletorDeMes
        rota={ROTA_DOS_PARCEIROS}
        parametros={parametros}
        meses={dados.meses}
        atual={dados.mes}
      />
      <FaixaDeKpis kpis={kpisDe(dados)} />
      {livres > 0 ? (
        <p className="text-muted-foreground text-sm" data-testid="agrupadores-livres">
          {livres === 1
            ? "1 agrupador do Sankhya ainda não é de nenhum parceiro."
            : `${formatarInteiro(livres)} agrupadores do Sankhya ainda não são de nenhum parceiro.`}{" "}
          Cadastre o parceiro e escolha o agrupador dele; a{" "}
          <Link
            href={enderecoDaConciliacao({ mes: dados.mes, agrupador: null, situacao: "todas" })}
            className="underline underline-offset-4"
          >
            conciliação
          </Link>{" "}
          já mostra os CRs de todos.
        </p>
      ) : null}
      {dados.linhas.length === 0 ? (
        filtrando ? (
          <ListaVazia
            titulo="Nenhum parceiro encontrado"
            descricao="Nenhum parceiro combina com a busca e os filtros. Limpe os filtros para ver todos."
            hrefLimpar={`${ROTA_DOS_PARCEIROS}?mes=${dados.mes}`}
          />
        ) : (
          <ListaVazia
            titulo="Nenhum parceiro cadastrado"
            descricao="Cadastre o primeiro parceiro (acionista, agregado ou locador) com o CPF ou CNPJ."
          />
        )
      ) : (
        <>
          <TabelaDeParceiros linhas={dados.linhas} mes={dados.mes} />
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {dados.linhas.length === 1
              ? "1 parceiro"
              : `${formatarInteiro(dados.linhas.length)} parceiros`}{" "}
            em {formatarMes(dados.mes)}
          </p>
        </>
      )}
    </PaginaDeLeitura>
  );
}

export async function PaginaDeParceiros({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const parametros = paraParametros(await searchParams);
  if (modoDosDados() !== "banco") {
    const { titulo, descricao } = cabecalho();
    return (
      <PaginaDeLeitura lista titulo={titulo} descricao={descricao}>
        <ListaVazia
          titulo="Os Parceiros leem só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para ver os parceiros e os totais do mês."
        />
      </PaginaDeLeitura>
    );
  }
  return <Conteudo parametros={parametros} />;
}
