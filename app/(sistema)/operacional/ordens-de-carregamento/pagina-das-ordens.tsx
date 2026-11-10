import { connection } from "next/server";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerOperacoes, lerOrdens, lerPatio } from "@/lib/dados/operacional";
import { FILTROS_DAS_ORDENS, type FiltroDasOrdens } from "@/lib/dados/operacional-tipos";
import { acharTela } from "@/lib/navegacao/catalogo";
import { enderecoDasOrdens, type EstadoDaLista, lerOrdensDaUrl } from "@/lib/navegacao/operacional";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import {
  FiltrosDaLista,
  PaginasDaLista,
  type ParametrosDaBusca,
  paraParametros,
} from "../navegacao-da-lista";
import { ListaDasOrdens } from "./lista-das-ordens";

const ROTA = "/operacional/ordens-de-carregamento";

function cabecalho() {
  const tela = acharTela(ROTA)?.tela;
  return { titulo: tela?.nome ?? "Ordens de carregamento", descricao: tela?.descricao };
}

const NOMES: Record<FiltroDasOrdens, string> = {
  todas: "Todas",
  carregando: "Carregando",
  carregada: "Carregadas",
  em_viagem: "Em viagem",
};

export function PaginaDasOrdensCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo="Carregando as ordens de carregamento" />
    </PaginaDeLeitura>
  );
}

async function Conteudo({
  estado,
  hoje,
}: {
  estado: EstadoDaLista<FiltroDasOrdens>;
  hoje: string;
}) {
  // O assistente "Criar ordem" guarda a chave pelo usuário da sessão (ProvedorDoUsuario).
  const [ordens, aguardando, operacoes, sessao] = await Promise.all([
    lerOrdens(estado),
    lerPatio({ filtro: "ACe", pagina: 1 }),
    lerOperacoes(),
    exigirSessao(),
  ]);
  const c = ordens.contagens;
  return (
    <>
      <FiltrosDaLista
        rotulo="Filtrar as ordens"
        filtros={FILTROS_DAS_ORDENS}
        nomes={NOMES}
        contagens={c}
        atual={estado.filtro}
        endereco={(filtro) => enderecoDasOrdens({ filtro, pagina: 1 })}
      />
      <FaixaDeKpis
        kpis={[
          { id: "todas", rotulo: "Ordens", valor: formatarInteiro(c.todas) },
          { id: "carregando", rotulo: "Carregando", valor: formatarInteiro(c.carregando) },
          { id: "carregada", rotulo: "Carregadas", valor: formatarInteiro(c.carregada) },
          { id: "em_viagem", rotulo: "Em viagem", valor: formatarInteiro(c.em_viagem) },
        ]}
      />
      <ProvedorDoUsuario usuario={sessao.usuarioId}>
        <ListaDasOrdens
          ordens={ordens.linhas}
          aguardando={aguardando.linhas}
          operacoes={operacoes}
          hoje={hoje}
        />
      </ProvedorDoUsuario>
      {ordens.total === 0 ? (
        estado.filtro === "todas" ? (
          <ListaVazia
            titulo="Nenhuma ordem de carregamento"
            descricao="Crie a primeira ordem para uma placa aceita no Pátio: ela passa a carregando e sai da fila."
          />
        ) : (
          <ListaVazia
            titulo={`Nenhuma ordem em "${NOMES[estado.filtro]}"`}
            descricao="Tire o filtro para ver todas as ordens."
            hrefLimpar={enderecoDasOrdens({ filtro: "todas", pagina: 1 })}
          />
        )
      ) : (
        <PaginasDaLista
          rotulo="Páginas das ordens"
          total={ordens.total}
          unidade="ordens"
          pagina={ordens.pagina}
          paginas={ordens.paginas}
          endereco={(pagina) => enderecoDasOrdens({ ...estado, pagina })}
          testId="total-das-ordens"
        />
      )}
    </>
  );
}

export async function PaginaDasOrdens({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const hoje = hojeEmSaoPaulo(new Date());
  const estado = lerOrdensDaUrl(paraParametros(await searchParams));
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      {modoDosDados() !== "banco" ? (
        <ListaVazia
          titulo="As Ordens de carregamento leem só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para criar e acompanhar as ordens."
        />
      ) : (
        <Conteudo estado={estado} hoje={hoje} />
      )}
    </PaginaDeLeitura>
  );
}
