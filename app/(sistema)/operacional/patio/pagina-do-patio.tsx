import { cookies } from "next/headers";
import { enderecoDoCsv } from "@/lib/navegacao/exportacao";
import { connection } from "next/server";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerOperacoes, lerPatio } from "@/lib/dados/operacional";
import { FILTROS_DO_PATIO, type FiltroDoPatio } from "@/lib/dados/operacional-tipos";
import { acharTela } from "@/lib/navegacao/catalogo";
import {
  lerTamanhoLembrado,
  NOME_DO_COOKIE_DO_TAMANHO,
} from "@/lib/navegacao/preferencias-da-tabela";
import { enderecoDoPatio, type EstadoDaLista, lerPatioDaUrl } from "@/lib/navegacao/operacional";
import { ACOES_EM_LOTE, acoesPossiveis } from "@/lib/dominio/esquemas/operacional";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import {
  FiltrosDaLista,
  PaginasDaLista,
  type ParametrosDaBusca,
  paraParametros,
} from "../navegacao-da-lista";
import { AvancarEmLote } from "../avancar-em-lote";
import { ListaDoPatio } from "./lista-do-patio";

const ROTA = "/operacional/patio";

function cabecalho() {
  const tela = acharTela(ROTA)?.tela;
  return { titulo: tela?.nome ?? "Pátio", descricao: tela?.descricao };
}

const NOMES: Record<FiltroDoPatio, string> = {
  todas: "Todas",
  fila: "Na fila",
  DOp: "DOp",
  ACe: "ACe",
  CAr: "CAr",
  CAn: "CAn",
};

export function PaginaDoPatioCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo="Carregando o pátio" />
    </PaginaDeLeitura>
  );
}

async function Conteudo({ estado, hoje }: { estado: EstadoDaLista<FiltroDoPatio>; hoje: string }) {
  // Os assistentes do pátio guardam a chave pelo usuário da sessão (ProvedorDoUsuario).
  const [patio, aguardando, operacoes, sessao] = await Promise.all([
    lerPatio(estado),
    lerPatio({ filtro: "ACe", pagina: 1, tam: 100 }),
    lerOperacoes(),
    exigirSessao(),
  ]);
  const c = patio.contagens;
  return (
    <>
      <FiltrosDaLista
        rotulo="Filtrar o pátio"
        filtros={FILTROS_DO_PATIO}
        nomes={NOMES}
        contagens={c}
        atual={estado.filtro}
        endereco={(filtro) => enderecoDoPatio({ filtro, pagina: 1, tam: estado.tam })}
      />
      <FaixaDeKpis
        kpis={[
          { id: "todas", rotulo: "Placas no pátio", valor: formatarInteiro(c.todas) },
          { id: "fila", rotulo: "Na fila", valor: formatarInteiro(c.fila) },
          { id: "ace", rotulo: "Aguardando carregamento", valor: formatarInteiro(c.ACe) },
          { id: "car", rotulo: "Carregando", valor: formatarInteiro(c.CAr + c.CAn) },
        ]}
      />
      {patio.total === 0 ? (
        estado.filtro === "todas" ? (
          <ListaVazia
            titulo="Nenhuma placa no pátio"
            descricao="Quando o gestor de frota entregar uma placa ao Operacional da sua filial, ela aparece aqui. O motorista entra na fila pelo Totem."
          />
        ) : (
          <ListaVazia
            titulo={`Nenhuma placa em "${NOMES[estado.filtro]}"`}
            descricao="Tire o filtro para ver o pátio inteiro."
            hrefLimpar={enderecoDoPatio({ filtro: "todas", pagina: 1, tam: estado.tam })}
          />
        )
      ) : (
        <>
          <ProvedorDoUsuario usuario={sessao.usuarioId}>
            <div className="flex flex-wrap items-start gap-3">
              {ACOES_EM_LOTE.map((acao) => (
                <AvancarEmLote
                  key={acao}
                  acao={acao}
                  placas={patio.linhas
                    .filter((l) => acoesPossiveis(l.sigla).includes(acao))
                    .map((l) => ({ ativoId: l.ativoId, placa: l.placa }))}
                />
              ))}
            </div>
            <ListaDoPatio
              linhas={patio.linhas}
              aguardando={aguardando.linhas}
              operacoes={operacoes}
              hoje={hoje}
            />
          </ProvedorDoUsuario>
          <PaginasDaLista
            rotulo="Páginas do pátio"
            total={patio.total}
            unidade="placas"
            pagina={patio.pagina}
            paginas={patio.paginas}
            endereco={(pagina) => enderecoDoPatio({ ...estado, pagina })}
            tam={estado.tam}
            enderecoDoTamanho={(tam) => enderecoDoPatio({ ...estado, tam, pagina: 1 })}
            testId="total-do-patio"
          />
        </>
      )}
    </>
  );
}

export async function PaginaDoPatio({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const hoje = hojeEmSaoPaulo(new Date());
  const tamLembrado = lerTamanhoLembrado(
    (await cookies()).get(NOME_DO_COOKIE_DO_TAMANHO)?.value,
    20,
  );
  const parametros = paraParametros(await searchParams);
  const estado = lerPatioDaUrl(parametros, tamLembrado);
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura
      titulo={titulo}
      descricao={descricao}
      exportar={enderecoDoCsv("operacional.patio", parametros)}
    >
      {modoDosDados() !== "banco" ? (
        <ListaVazia
          titulo="O Pátio lê só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para ver as placas no pátio e a fila."
        />
      ) : (
        <Conteudo estado={estado} hoje={hoje} />
      )}
    </PaginaDeLeitura>
  );
}
