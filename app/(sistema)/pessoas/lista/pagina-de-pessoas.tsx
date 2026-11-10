import { cookies } from "next/headers";
import { connection } from "next/server";
import { formatarInteiro } from "@/components/formato/numero";
import {
  BarraDeConsultaDaPagina,
  type ChipDeConsulta,
} from "@/components/layout/barra-de-consulta";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { Paginador } from "@/components/tabela/paginador";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerPessoasDaLista, type OperacaoParaEscolher } from "@/lib/dados/pessoas";
import {
  lerTamanhoLembrado,
  NOME_DO_COOKIE_DO_TAMANHO,
} from "@/lib/navegacao/preferencias-da-tabela";
import { acharTela } from "@/lib/navegacao/catalogo";
import {
  CAMPOS_DAS_PESSOAS,
  CHIPS_DE_FUNCAO,
  CHIPS_DE_SITUACAO,
  lerPessoas,
  PADRAO_DAS_PESSOAS,
  ROTA_DAS_PESSOAS,
} from "@/lib/navegacao/pessoas";
import { temPermissao } from "@/lib/seguranca/exigir-permissao";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { CadastrarPessoa } from "./cadastrar-pessoa";
import { FiltroDeOperacao } from "./filtro-de-operacao";
import { TabelaDePessoas } from "./tabela-de-pessoas";

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

// Pessoas › lista (primeira versão): cada pessoa com o CPF mascarado, a situação e o vínculo de hoje
// (operação e função). Busca, chips de situação e de função, operação, ordem e página na URL; o banco
// filtra, ordena, pagina e conta (nucleo.pessoas_da_lista). O assistente "Cadastrar pessoa" grava pela
// função do banco.

function cabecalho() {
  const tela = acharTela(ROTA_DAS_PESSOAS)?.tela;
  return { titulo: tela?.nome ?? "Pessoas", descricao: tela?.descricao };
}

export function paraParametros(
  bruto: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(bruto)) {
    for (const item of Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]) {
      parametros.append(chave, item);
    }
  }
  return parametros;
}

const APRESENTACAO = {
  situacao: {
    titulo: "Situação",
    subtitulo: "O vínculo de hoje",
    forma: "pilula",
    destaque: "acao",
  },
  funcao: {
    titulo: "Função",
    subtitulo: "O que a pessoa faz na operação",
    forma: "retangulo",
    destaque: "escuro",
  },
} as const;

function chipsDe(contagens: Record<string, number> | null): ChipDeConsulta[] {
  return [
    ...CHIPS_DE_SITUACAO.map((c) => ({ ...c, grupo: "situacao", contagem: contagens?.[c.id] })),
    ...CHIPS_DE_FUNCAO.map((c) => ({ ...c, grupo: "funcao", contagem: contagens?.[c.id] })),
  ];
}

function Barra({
  contagens,
  operacoes,
}: {
  contagens: Record<string, number> | null;
  operacoes: readonly OperacaoParaEscolher[];
}) {
  return (
    <BarraDeConsultaDaPagina
      rotulo="Buscar pessoa"
      chips={chipsDe(contagens)}
      apresentacaoDosGrupos={APRESENTACAO}
      filtrosExtras={["operacao"]}
      aviso={operacoes.length > 0 ? <FiltroDeOperacao operacoes={operacoes} /> : undefined}
    />
  );
}

export function PaginaDePessoasCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura
      lista
      titulo={titulo}
      descricao={descricao}
      consulta={<Barra contagens={null} operacoes={[]} />}
    >
      <EsqueletoDaTabela rotulo="Carregando as pessoas" />
    </PaginaDeLeitura>
  );
}

async function Conteudo({ parametros }: { parametros: URLSearchParams }) {
  const sessao = await exigirSessao();
  const tam = lerTamanhoLembrado(
    (await cookies()).get(NOME_DO_COOKIE_DO_TAMANHO)?.value,
    PADRAO_DAS_PESSOAS.tam,
  );
  const estado = lerPessoas(parametros, tam);
  const dados = await lerPessoasDaLista(estado);
  const filtrando =
    estado.consulta.busca !== "" || estado.consulta.chips.length > 0 || estado.operacao !== null;
  const { titulo, descricao } = cabecalho();
  const podeCadastrar = temPermissao(sessao.perfil, { modulo: "pessoas", acao: "criar" });
  return (
    <PaginaDeLeitura
      lista
      titulo={titulo}
      descricao={descricao}
      acoes={
        podeCadastrar ? (
          <CadastrarPessoa operacoes={dados.operacoes} usuario={sessao.usuarioId} />
        ) : undefined
      }
      consulta={<Barra contagens={dados.chips} operacoes={dados.operacoes} />}
    >
      <FaixaDeKpis
        kpis={[
          { id: "pessoas", rotulo: "Pessoas no filtro", valor: formatarInteiro(dados.filtradas) },
          {
            id: "com_vinculo",
            rotulo: "Com vínculo hoje",
            valor: formatarInteiro(dados.chips.com_vinculo ?? 0),
          },
          {
            id: "sem_vinculo",
            rotulo: "Sem vínculo",
            valor: formatarInteiro(dados.chips.sem_vinculo ?? 0),
          },
          {
            id: "pendente",
            rotulo: "Cadastro pendente",
            valor: formatarInteiro(dados.chips.pendente ?? 0),
            apoio: "Vieram da v1 sem CPF",
          },
        ]}
      />
      {dados.filtradas === 0 ? (
        filtrando ? (
          <ListaVazia
            titulo="Nenhuma pessoa encontrada"
            descricao="Nenhuma pessoa combina com a busca e os filtros. Limpe os filtros para ver todas."
            hrefLimpar={ROTA_DAS_PESSOAS}
          />
        ) : (
          <ListaVazia
            titulo="Nenhuma pessoa cadastrada"
            descricao="Cadastre a primeira pessoa pelo botão Cadastrar pessoa, com o CPF e o vínculo com a operação."
          />
        )
      ) : (
        <TabelaDePessoas linhas={dados.linhas} />
      )}
      <Paginador
        pagina={dados.pagina}
        paginas={dados.paginas}
        total={dados.filtradas}
        tam={dados.tam}
        itens="pessoas"
        padrao={{ ...PADRAO_DAS_PESSOAS, tam }}
        campos={CAMPOS_DAS_PESSOAS}
      />
    </PaginaDeLeitura>
  );
}

export async function PaginaDePessoas({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const parametros = paraParametros(await searchParams);
  if (modoDosDados() !== "banco") {
    const { titulo, descricao } = cabecalho();
    return (
      <PaginaDeLeitura lista titulo={titulo} descricao={descricao}>
        <ListaVazia
          titulo="As Pessoas leem só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para ver e cadastrar pessoas."
        />
      </PaginaDeLeitura>
    );
  }
  return <Conteudo parametros={parametros} />;
}
