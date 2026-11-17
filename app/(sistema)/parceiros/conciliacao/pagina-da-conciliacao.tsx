import { IconLock } from "@tabler/icons-react";
import Link from "next/link";
import { connection } from "next/server";
import { formatarData, formatarMes } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro } from "@/components/formato/numero";
import { AvisoDeDadosCongelados } from "@/components/layout/aviso-de-dados-congelados";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { Button } from "@/components/ui/button";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import { lerDadosAte } from "@/lib/dados/dados-ate";
import { modoDosDados } from "@/lib/dados/fonte";
import { mesIncompleto } from "@/lib/dominio/dados-congelados";
import { lerConciliacaoDoMes, lerConferenciasDaConciliacao } from "@/lib/dados/parceiros";
import { pendentesDoAcionista, resumoDoAcionista } from "@/lib/dominio/conciliar-o-mes";
import { NOMES_DAS_SITUACOES_DA_CONCILIACAO } from "@/lib/dados/parceiros-tipos";
import { acharTela } from "@/lib/navegacao/catalogo";
import {
  enderecoDaConciliacao,
  type EstadoDaConciliacao,
  type FiltroDaConciliacao,
  lerConciliacao,
  ROTA_DA_CONCILIACAO,
  SITUACOES_DA_CONCILIACAO,
} from "@/lib/navegacao/parceiros";
import { temPermissao } from "@/lib/seguranca/exigir-permissao";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { FiltrosDaLista } from "../../operacional/navegacao-da-lista";
import {
  paraParametros,
  type ParametrosDaBusca,
  SeletorDeMes,
} from "../../operacoes/lista/pagina-de-operacoes";
import { ConciliarOMes } from "./conciliar-o-mes";
import { ListaDaConciliacao } from "./lista-da-conciliacao";

export type { ParametrosDaBusca };

// Parceiros › conciliação (primeira versão): por CR de acionista no mês, o que o Sankhya lançou × as
// placas que o Eixo espera, com a situação e a justificativa. Os números vêm do staging provisório (a
// cópia da v1) até a ponte do Sankhya; o fato importado nunca é editado.

function cabecalho() {
  const tela = acharTela(ROTA_DA_CONCILIACAO)?.tela;
  return { titulo: tela?.nome ?? "Conciliação", descricao: tela?.descricao };
}

const NOMES: Record<FiltroDaConciliacao, string> = {
  todas: "Todas",
  ...NOMES_DAS_SITUACOES_DA_CONCILIACAO,
};

export function PaginaDaConciliacaoCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura lista titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo="Carregando a conciliação" />
    </PaginaDeLeitura>
  );
}

/** Escolher o parceiro (o agrupador do Sankhya): um formulário simples, com o estado na URL. */
function EscolherParceiro({
  estado,
  mes,
  parceiros,
}: {
  estado: EstadoDaConciliacao;
  mes: string;
  parceiros: { agrupadorId: string; nome: string; cadastrado: boolean }[];
}) {
  return (
    <form method="get" action={ROTA_DA_CONCILIACAO} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="mes" value={mes} />
      {estado.situacao !== "todas" ? (
        <input type="hidden" name="situacao" value={estado.situacao} />
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Parceiro</span>
        <select
          name="agrupador"
          defaultValue={estado.agrupador ?? ""}
          className={`${CLASSE_DO_CAMPO} min-w-72`}
        >
          <option value="">Todos os parceiros</option>
          {parceiros.map((p) => (
            <option key={p.agrupadorId} value={p.agrupadorId}>
              {p.nome}
              {p.cadastrado ? "" : " (sem cadastro)"}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="outline">
        Mostrar parceiro
      </Button>
    </form>
  );
}

async function Conteudo({ parametros }: { parametros: URLSearchParams }) {
  const estado = lerConciliacao(parametros);
  const [dados, sessao, dadosAte] = await Promise.all([
    lerConciliacaoDoMes(estado),
    exigirSessao(),
    lerDadosAte(),
  ]);
  const podeJustificar = temPermissao(sessao.perfil, { modulo: "parceiros", acao: "criar" });
  const podeConciliar =
    podeJustificar && temPermissao(sessao.perfil, { modulo: "parceiros", acao: "editar" });
  // Conciliar o mês é por acionista: as linhas dele no mês inteiro, sem o filtro de situação.
  const [conferencias, linhasDoAcionista] = await Promise.all([
    lerConferenciasDaConciliacao(dados.mes),
    estado.agrupador && estado.situacao !== "todas"
      ? lerConciliacaoDoMes({ ...estado, mes: dados.mes, situacao: "todas" }).then((d) => d.linhas)
      : Promise.resolve(dados.linhas),
  ]);
  const conferidos = conferencias.map((x) => x.agrupadorId);
  const conferida = estado.agrupador
    ? conferencias.find((x) => x.agrupadorId === estado.agrupador)
    : undefined;
  const nomeDoParceiro =
    dados.parceiros.find((p) => p.agrupadorId === estado.agrupador)?.nome ?? "o parceiro";
  const resumo = estado.agrupador ? resumoDoAcionista(linhasDoAcionista, estado.agrupador) : null;
  const c = dados.contagens;
  return (
    <>
      <AvisoDeDadosCongelados dadosAte={dadosAte} />
      <SeletorDeMes
        rota={ROTA_DA_CONCILIACAO}
        parametros={parametros}
        meses={dados.meses}
        atual={dados.mes}
        mesIncompleto={mesIncompleto(dadosAte)}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <EscolherParceiro estado={estado} mes={dados.mes} parceiros={dados.parceiros} />
        <FiltrosDaLista
          rotulo="Filtrar pela situação"
          filtros={SITUACOES_DA_CONCILIACAO}
          nomes={NOMES}
          contagens={c}
          atual={estado.situacao}
          endereco={(situacao) => enderecoDaConciliacao({ ...estado, mes: dados.mes, situacao })}
        />
      </div>
      {conferida ? (
        <p
          role="status"
          className="bg-status-em-atividade-suave flex w-fit flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <IconLock aria-hidden className="size-4" />
          Mês de {nomeDoParceiro} conferido em {formatarData(conferida.conferidaEm)} e travado.
          Correção só como ajuste de período anterior, em{" "}
          <Link href="/resultados/ajustes" className="underline underline-offset-2">
            Resultados › Ajustes
          </Link>
          .
        </p>
      ) : estado.agrupador && resumo && resumo.linhas > 0 && podeConciliar ? (
        <div className="flex flex-wrap items-center gap-3">
          <ConciliarOMes
            agrupadorId={estado.agrupador}
            parceiro={nomeDoParceiro}
            mes={dados.mes}
            pendentes={pendentesDoAcionista(linhasDoAcionista, estado.agrupador)}
            resumo={resumo}
          />
          <span className="text-muted-foreground text-sm">
            {resumo.pendentes === 0
              ? "Nenhuma diferença pendente: o mês pode ser conferido."
              : `${formatarInteiro(resumo.pendentes)} ${resumo.pendentes === 1 ? "diferença pede" : "diferenças pedem"} justificativa antes de travar o mês.`}
          </span>
        </div>
      ) : !estado.agrupador && podeConciliar && dados.linhas.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          Para conciliar o mês, escolha o parceiro e clique em Mostrar parceiro.
        </p>
      ) : null}
      <FaixaDeKpis
        kpis={[
          { id: "linhas", rotulo: "CRs no mês", valor: formatarInteiro(c.todas) },
          { id: "diferenca", rotulo: "Com diferença", valor: formatarInteiro(c.diferenca) },
          { id: "sem", rotulo: "Sem lançamento", valor: formatarInteiro(c.sem_lancamento) },
          {
            id: "despesa",
            rotulo: "Despesa lançada",
            valor: <Moeda valor={dados.totais.despesaCentavos} />,
          },
          {
            id: "fora",
            rotulo: "Lançado com outra placa",
            valor: <Moeda valor={dados.totais.foraDaPlacaCentavos} />,
          },
        ]}
      />
      {dados.linhas.length === 0 ? (
        estado.situacao !== "todas" || estado.agrupador ? (
          <ListaVazia
            titulo="Nenhuma linha com esses filtros"
            descricao="Tire os filtros para ver todos os CRs de acionista do mês."
            hrefLimpar={enderecoDaConciliacao({
              mes: dados.mes,
              agrupador: null,
              situacao: "todas",
            })}
          />
        ) : (
          <ListaVazia
            titulo={`Nada a conciliar em ${formatarMes(dados.mes)}`}
            descricao="A conciliação mostra os CRs de acionista com placa no Eixo ou com lançamento do Sankhya no mês."
          />
        )
      ) : (
        <ProvedorDoUsuario usuario={sessao.usuarioId}>
          <ListaDaConciliacao
            linhas={dados.linhas}
            mes={dados.mes}
            podeJustificar={podeJustificar}
            conferidos={conferidos}
          />
        </ProvedorDoUsuario>
      )}
    </>
  );
}

export async function PaginaDaConciliacao({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const parametros = paraParametros(await searchParams);
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura lista titulo={titulo} descricao={descricao}>
      {modoDosDados() !== "banco" ? (
        <ListaVazia
          titulo="A Conciliação lê só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para conferir o Sankhya com o Eixo."
        />
      ) : (
        <Conteudo parametros={parametros} />
      )}
    </PaginaDeLeitura>
  );
}
