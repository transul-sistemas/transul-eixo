import { cookies } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { formatarMes } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import {
  formatarInteiro,
  formatarKm,
  formatarKmPorLitro,
  formatarLitros,
} from "@/components/formato/numero";
import { BarraDeConsultaDaPagina } from "@/components/layout/barra-de-consulta";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { AvisoDeDadosCongelados } from "@/components/layout/aviso-de-dados-congelados";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { Paginador } from "@/components/tabela/paginador";
import { lerAbastecimentoDoMes } from "@/lib/dados/abastecimento";
import { lerDadosAteDaFonte } from "@/lib/dados/dados-ate";
import { modoDosDados } from "@/lib/dados/fonte";
import {
  CAMPOS_DO_ABASTECIMENTO,
  enderecoDoMesDoAbastecimento,
  lerAbastecimento,
  PADRAO_DO_ABASTECIMENTO,
  ROTA_DO_ABASTECIMENTO,
} from "@/lib/navegacao/abastecimento";
import { acharTela } from "@/lib/navegacao/catalogo";
import {
  lerTamanhoLembrado,
  NOME_DO_COOKIE_DO_TAMANHO,
} from "@/lib/navegacao/preferencias-da-tabela";
import { escreverTabela } from "@/lib/navegacao/tabela";
import { cn } from "@/lib/utils";
import { TabelaDoAbastecimento } from "./tabela-do-abastecimento";

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

// Frota › Abastecimento (primeira versão): litros, km rodado e km/l por placa no mês. Os números vêm
// do staging provisório (a cópia da v1) até a ponte do Sankhya; o banco entrega tudo somado.

function cabecalho() {
  const tela = acharTela(ROTA_DO_ABASTECIMENTO)?.tela;
  return { titulo: tela?.nome ?? "Abastecimento", descricao: tela?.descricao };
}

const classeDoMes =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm tabular-nums outline-none focus-visible:ring-3";

function paraParametros(bruto: Record<string, string | string[] | undefined>): URLSearchParams {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(bruto)) {
    for (const item of Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]) {
      parametros.append(chave, item);
    }
  }
  return parametros;
}

function Barra() {
  return <BarraDeConsultaDaPagina rotulo="Buscar placa" chips={[]} />;
}

export function PaginaDoAbastecimentoCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura lista titulo={titulo} descricao={descricao} consulta={<Barra />}>
      <EsqueletoDaTabela rotulo="Carregando o abastecimento" />
    </PaginaDeLeitura>
  );
}

async function Conteudo({ parametros }: { parametros: URLSearchParams }) {
  const tam = lerTamanhoLembrado(
    (await cookies()).get(NOME_DO_COOKIE_DO_TAMANHO)?.value,
    PADRAO_DO_ABASTECIMENTO.tam,
  );
  const estado = lerAbastecimento(parametros, tam);
  const [dados, dadosAte] = await Promise.all([
    lerAbastecimentoDoMes(estado),
    lerDadosAteDaFonte("abastecimento"),
  ]);
  const { totais } = dados;
  const semBusca = (() => {
    const limpa = escreverTabela(
      parametros,
      { ...estado.consulta, busca: "", pagina: 1 },
      { ...PADRAO_DO_ABASTECIMENTO, tam },
    ).toString();
    return limpa ? `${ROTA_DO_ABASTECIMENTO}?${limpa}` : ROTA_DO_ABASTECIMENTO;
  })();

  return (
    <>
      <AvisoDeDadosCongelados dadosAte={dadosAte} />
      {dados.meses.length > 0 ? (
        <nav aria-label="Mês do abastecimento" className="flex flex-wrap gap-2">
          {dados.meses.slice(0, 12).map((mes) => (
            <Link
              key={mes}
              href={enderecoDoMesDoAbastecimento(parametros, mes)}
              aria-current={mes === dados.mes ? "page" : undefined}
              className={cn(
                classeDoMes,
                mes === dados.mes && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {formatarMes(mes)}
            </Link>
          ))}
        </nav>
      ) : null}
      <FaixaDeKpis
        kpis={[
          { id: "placas", rotulo: "Placas abastecidas", valor: formatarInteiro(totais.placas) },
          { id: "litros", rotulo: "Litros", valor: formatarLitros(totais.litros) },
          { id: "km", rotulo: "Km rodado", valor: formatarKm(totais.km) },
          {
            id: "km_por_litro",
            rotulo: "Km/l da frota",
            valor: formatarKmPorLitro(totais.kmPorLitro),
            apoio: "Só abastecimentos com hodômetro válido",
          },
          { id: "valor", rotulo: "Valor", valor: <Moeda valor={totais.valorCentavos} /> },
          {
            id: "sem_hodometro",
            rotulo: "Sem hodômetro válido",
            valor: formatarInteiro(totais.semHodometro),
          },
        ]}
      />
      {dados.filtradas === 0 ? (
        estado.consulta.busca !== "" ? (
          <ListaVazia
            titulo="Nenhuma placa encontrada"
            descricao="Nenhuma placa abastecida no mês combina com a busca. Limpe a busca para ver o mês inteiro."
            hrefLimpar={semBusca}
          />
        ) : (
          <ListaVazia
            titulo={`Nenhum abastecimento em ${formatarMes(dados.mes)}`}
            descricao="Os abastecimentos aparecem aqui quando forem carregados. Até a ponte do Sankhya, eles vêm da cópia da v1 (carga local)."
          />
        )
      ) : (
        <TabelaDoAbastecimento linhas={dados.linhas} />
      )}
      <Paginador
        pagina={dados.pagina}
        paginas={dados.paginas}
        total={dados.filtradas}
        tam={dados.tam}
        itens="placas"
        padrao={{ ...PADRAO_DO_ABASTECIMENTO, tam }}
        campos={CAMPOS_DO_ABASTECIMENTO}
      />
    </>
  );
}

export async function PaginaDoAbastecimento({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const parametros = paraParametros(await searchParams);
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura lista titulo={titulo} descricao={descricao} consulta={<Barra />}>
      {modoDosDados() !== "banco" ? (
        <ListaVazia
          titulo="O Abastecimento lê só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para ver o consumo por placa."
        />
      ) : (
        <Conteudo parametros={parametros} />
      )}
    </PaginaDeLeitura>
  );
}
