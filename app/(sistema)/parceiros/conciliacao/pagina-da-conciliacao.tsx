import { connection } from "next/server";
import { formatarMes } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro } from "@/components/formato/numero";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { Button } from "@/components/ui/button";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerConciliacaoDoMes } from "@/lib/dados/parceiros";
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
  const [dados, sessao] = await Promise.all([lerConciliacaoDoMes(estado), exigirSessao()]);
  const podeJustificar = temPermissao(sessao.perfil, { modulo: "parceiros", acao: "criar" });
  const c = dados.contagens;
  return (
    <>
      <SeletorDeMes
        rota={ROTA_DA_CONCILIACAO}
        parametros={parametros}
        meses={dados.meses}
        atual={dados.mes}
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
