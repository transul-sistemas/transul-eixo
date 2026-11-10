import { connection } from "next/server";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro } from "@/components/formato/numero";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerLocacoes } from "@/lib/dados/parceiros";
import { NOMES_DAS_SITUACOES_DA_LOCACAO } from "@/lib/dados/parceiros-tipos";
import { acharTela } from "@/lib/navegacao/catalogo";
import {
  enderecoDaLocacao,
  type FiltroDaLocacao,
  lerLocacao,
  ROTA_DA_LOCACAO,
  SITUACOES_DA_LOCACAO,
} from "@/lib/navegacao/parceiros";
import { temPermissao } from "@/lib/seguranca/exigir-permissao";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { FiltrosDaLista } from "../../operacional/navegacao-da-lista";
import { paraParametros, type ParametrosDaBusca } from "../../operacoes/lista/pagina-de-operacoes";
import { ListaDasLocacoes } from "./lista-das-locacoes";

export type { ParametrosDaBusca };

// Parceiros › locação (primeira versão): os contratos de locação de placa (parceiro, placa, vigência
// [início, fim) e valor mensal), com os assistentes Cadastrar locação e Encerrar locação. O banco
// garante que a mesma placa não tem duas locações ao mesmo tempo.

function cabecalho() {
  const tela = acharTela(ROTA_DA_LOCACAO)?.tela;
  return { titulo: tela?.nome ?? "Locação", descricao: tela?.descricao };
}

export function PaginaDaLocacaoCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo="Carregando as locações" />
    </PaginaDeLeitura>
  );
}

async function Conteudo({ situacao }: { situacao: FiltroDaLocacao }) {
  const [dados, sessao] = await Promise.all([lerLocacoes(situacao), exigirSessao()]);
  const c = dados.contagens;
  return (
    <>
      <FiltrosDaLista
        rotulo="Filtrar as locações"
        filtros={SITUACOES_DA_LOCACAO}
        nomes={NOMES_DAS_SITUACOES_DA_LOCACAO}
        contagens={c}
        atual={situacao}
        endereco={enderecoDaLocacao}
      />
      <FaixaDeKpis
        kpis={[
          { id: "vigentes", rotulo: "Locações vigentes", valor: formatarInteiro(c.vigente) },
          {
            id: "placas",
            rotulo: "Placas locadas agora",
            valor: formatarInteiro(dados.totais.placasVigentes),
          },
          {
            id: "valor",
            rotulo: "Valor mensal vigente",
            valor: <Moeda valor={dados.totais.valorMensalVigenteCentavos} />,
          },
          { id: "encerradas", rotulo: "Encerradas", valor: formatarInteiro(c.encerrada) },
        ]}
      />
      <ProvedorDoUsuario usuario={sessao.usuarioId}>
        <ListaDasLocacoes
          dados={dados}
          podeCadastrar={temPermissao(sessao.perfil, { modulo: "parceiros", acao: "criar" })}
          podeEncerrar={temPermissao(sessao.perfil, { modulo: "parceiros", acao: "editar" })}
        />
      </ProvedorDoUsuario>
      {dados.linhas.length === 0 ? (
        situacao === "todas" ? (
          <ListaVazia
            titulo="Nenhuma locação cadastrada"
            descricao={
              dados.parceiros.length === 0
                ? "Cadastre primeiro o parceiro (em Parceiros) e depois a locação da placa."
                : "Cadastre a primeira locação: o parceiro, a placa, a vigência e o valor mensal."
            }
          />
        ) : (
          <ListaVazia
            titulo={`Nenhuma locação em "${NOMES_DAS_SITUACOES_DA_LOCACAO[situacao]}"`}
            descricao="Tire o filtro para ver todas as locações."
            hrefLimpar={enderecoDaLocacao("todas")}
          />
        )
      ) : null}
    </>
  );
}

export async function PaginaDaLocacao({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const situacao = lerLocacao(paraParametros(await searchParams));
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      {modoDosDados() !== "banco" ? (
        <ListaVazia
          titulo="A Locação lê só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para cadastrar e acompanhar as locações."
        />
      ) : (
        <Conteudo situacao={situacao} />
      )}
    </PaginaDeLeitura>
  );
}
