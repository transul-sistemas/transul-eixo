import { connection } from "next/server";
import { AbaEmBreve } from "@/components/ficha/aba-em-breve";
import { AbasDaFichaNaUrl } from "@/components/ficha/abas-da-ficha-na-url";
import { CabecalhoDaFicha } from "@/components/ficha/cabecalho-da-ficha";
import { FichaDaRaiz } from "@/components/ficha/ficha-da-raiz";
import { formatarMes } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro, formatarPercentual } from "@/components/formato/numero";
import { ListaVazia } from "@/components/tabela/estados";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerFichaDaOperacao } from "@/lib/dados/operacoes";
import { type FichaDaOperacao, NOMES_DOS_TIPOS_DE_OPERACAO } from "@/lib/dados/operacoes-tipos";
import { lerAba } from "@/lib/navegacao/ficha";
import {
  ABAS_DA_OPERACAO,
  type AbaDaOperacao,
  IDS_DAS_ABAS_DA_OPERACAO,
  lerMes,
} from "@/lib/navegacao/operacoes";
import { temPermissao } from "@/lib/seguranca/exigir-permissao";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { EditarOperacao } from "../editar-operacao";
import { paraParametros, type ParametrosDaBusca, SeletorDeMes } from "../pagina-de-operacoes";
import { TabelaDasNaturezas, TabelaDasPessoas, TabelaDasPlacas } from "./tabelas-da-ficha";
import { VoltarALista } from "./voltar-a-lista";

// A ficha da operação (primeira versão): cabeçalho com o assistente "Editar operação", o mês e as abas
// (Resumo com a cascata Frota + Serviço do mês, Placas vinculadas agora, Pessoas da folha e Resultado
// por natureza; as demais em breve). Tudo pronto do banco (nucleo.ficha_da_operacao).

/** Uma linha da cascata: o rótulo, o valor (custos entram com sinal negativo) e o apoio. */
function LinhaDaCascata({
  rotulo,
  valor,
  apoio,
  total = false,
}: {
  rotulo: string;
  valor: number;
  apoio?: string;
  total?: boolean;
}) {
  return (
    <div
      className={
        total
          ? "border-border flex items-baseline justify-between gap-4 border-t pt-3 text-lg font-semibold"
          : "flex items-baseline justify-between gap-4"
      }
    >
      <dt className="flex flex-col">
        <span>{rotulo}</span>
        {apoio ? <span className="text-muted-foreground text-sm font-normal">{apoio}</span> : null}
      </dt>
      <dd>
        <Moeda valor={valor} />
      </dd>
    </div>
  );
}

function Cascata({ ficha }: { ficha: FichaDaOperacao }) {
  const c = ficha.cascata;
  if (!c) {
    return (
      <p className="text-muted-foreground text-sm" data-testid="sem-resultado">
        O resultado em R$ aparece para quem tem acesso a Resultados.
      </p>
    );
  }
  return (
    <section
      aria-labelledby="titulo-da-cascata"
      className="border-border bg-card flex max-w-2xl flex-col gap-3 rounded-xl border p-5"
    >
      <h3 id="titulo-da-cascata" className="text-base font-semibold">
        Cascata de {formatarMes(ficha.mes)}
      </h3>
      <dl aria-label="Cascata do mês" className="flex flex-col gap-3">
        <LinhaDaCascata
          rotulo="Receita de viagens (CT-e e NFS-e)"
          valor={c.receitaCentavos}
          apoio={`${formatarInteiro(c.documentos)} ${c.documentos === 1 ? "documento" : "documentos"}`}
        />
        <LinhaDaCascata
          rotulo="Custos da Frota"
          valor={-c.custoFrotaCentavos}
          apoio="Despesas dos CRs de frota da operação"
        />
        <LinhaDaCascata
          rotulo="Custos de Serviço e pessoal"
          valor={-c.custoServicoCentavos}
          apoio="Despesas dos demais CRs, salários inclusive"
        />
        <LinhaDaCascata
          rotulo="Margem"
          valor={c.margemCentavos}
          apoio={
            c.margemPercentual === null
              ? "Sem receita no mês"
              : `${formatarPercentual(c.margemPercentual)} da receita`
          }
          total
        />
      </dl>
      <p className="text-muted-foreground text-sm">
        {formatarInteiro(c.crs)} {c.crs === 1 ? "CR" : "CRs"} na operação no mês. Despesas pela
        competência gerencial, sem provisões; números da cópia da v1 até a ponte do Sankhya.
      </p>
    </section>
  );
}

function Resultado({ ficha }: { ficha: FichaDaOperacao }) {
  const c = ficha.cascata;
  if (!c) return <Cascata ficha={ficha} />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-2">
        <h3 className="text-base font-semibold">Custos da Frota por natureza</h3>
        {c.frotaPorNatureza.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma despesa de frota no mês.</p>
        ) : (
          <TabelaDasNaturezas
            rotulo="Custos da Frota por natureza"
            naturezas={c.frotaPorNatureza}
          />
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-base font-semibold">Custos de Serviço por natureza</h3>
        {c.servicoPorNatureza.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma despesa de serviço no mês.</p>
        ) : (
          <TabelaDasNaturezas
            rotulo="Custos de Serviço por natureza"
            naturezas={c.servicoPorNatureza}
          />
        )}
      </section>
    </div>
  );
}

function Pessoas({ ficha }: { ficha: FichaDaOperacao }) {
  const p = ficha.pessoas;
  if (!p) {
    return (
      <p className="text-muted-foreground text-sm">
        A folha da operação aparece para quem tem acesso a Resultados.
      </p>
    );
  }
  if (p.funcionarios === 0) {
    return (
      <ListaVazia
        titulo={`Ninguém na folha em ${formatarMes(ficha.mes)}`}
        descricao="As pessoas aparecem aqui quando a folha do mês tiver funcionários nos CRs da operação."
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {formatarInteiro(p.funcionarios)} {p.funcionarios === 1 ? "funcionário" : "funcionários"} na
        folha de {formatarMes(ficha.mes)}, com{" "}
        <Moeda valor={p.salarioBrutoCentavos} className="inline" /> de salário bruto. Sem nomes: a
        folha da v1 vem só pelo código do funcionário.
      </p>
      <TabelaDasPessoas pessoas={p} />
    </div>
  );
}

/** A ficha da operação. Sem a operação (ou fora do alcance), o aviso com o caminho de volta. */
export async function FichaDaOperacaoNaTela({
  id,
  searchParams,
}: {
  id: string;
  searchParams: ParametrosDaBusca;
}) {
  await connection();
  const sessao = await exigirSessao();
  const parametros = paraParametros(await searchParams);
  if (modoDosDados() !== "banco") {
    return (
      <div className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
        <VoltarALista />
        <ListaVazia
          titulo="A ficha da operação lê só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco."
        />
      </div>
    );
  }
  const ficha = await lerFichaDaOperacao(id, lerMes(parametros));
  if (!ficha) {
    return (
      <div className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
        <VoltarALista />
        <h1 className="text-3xl font-semibold tracking-tight">Operação não encontrada</h1>
        <ListaVazia
          titulo="Esta operação não está ao seu alcance"
          descricao="Ela pode ter sido arquivada ou estar fora do seu escopo. Volte à lista e procure de novo."
        />
      </div>
    );
  }

  const { operacao } = ficha;
  const base =
    operacao.baseCidade || operacao.baseUf
      ? [operacao.baseCidade, operacao.baseUf].filter(Boolean).join("/")
      : "sem base";
  const podeEditar = temPermissao(sessao.perfil, { modulo: "operacoes", acao: "editar" });
  const emBreve = (nome: string, descricao: string) => (
    <AbaEmBreve nome={nome} descricao={descricao} modulo="operacoes" />
  );

  const conteudos: Record<AbaDaOperacao, React.ReactNode> = {
    resumo: <Cascata ficha={ficha} />,
    placas:
      ficha.placas.length === 0 ? (
        <ListaVazia
          titulo="Nenhuma placa vinculada agora"
          descricao="As placas aparecem aqui quando forem montadas nesta operação (Frota › Placas)."
        />
      ) : (
        <TabelaDasPlacas placas={ficha.placas} />
      ),
    pessoas: <Pessoas ficha={ficha} />,
    resultado: <Resultado ficha={ficha} />,
    "linha-do-tempo": emBreve(
      "Linha do tempo",
      "Mostra as placas e os CRs que entraram e saíram da operação ao longo do tempo.",
    ),
    documentos: emBreve("Documentos", "Guarda os contratos e os documentos da operação."),
    mapa: emBreve("Mapa", "Mostra as rotas e onde estão as placas da operação."),
    "mapa-mental": emBreve(
      "Mapa mental",
      "Mostra a operação ligada às placas, aos CRs, às pessoas e aos clientes.",
    ),
  };

  return (
    <FichaDaRaiz
      cabecalho={
        <CabecalhoDaFicha
          voltar={<VoltarALista />}
          titulo={operacao.nome}
          subtitulo={`${NOMES_DOS_TIPOS_DE_OPERACAO[operacao.tipo]}, base ${base}${
            operacao.filial ? `, filial ${operacao.filial}` : ""
          }`}
          situacao={
            <span className="text-muted-foreground text-sm">
              {formatarInteiro(ficha.placas.length)}{" "}
              {ficha.placas.length === 1 ? "placa vinculada" : "placas vinculadas"} agora
            </span>
          }
          acoes={
            podeEditar ? (
              <EditarOperacao operacao={operacao} usuario={sessao.usuarioId} />
            ) : undefined
          }
        />
      }
      linhaDoTempo={
        <SeletorDeMes
          rota={`/operacoes/lista/${operacao.id}`}
          parametros={parametros}
          meses={ficha.meses}
          atual={ficha.mes}
        />
      }
    >
      <AbasDaFichaNaUrl<AbaDaOperacao>
        abas={ABAS_DA_OPERACAO}
        abaInicial={lerAba(parametros, IDS_DAS_ABAS_DA_OPERACAO)}
        conteudos={conteudos}
      />
    </FichaDaRaiz>
  );
}

/** O que se vê enquanto a ficha chega: o esqueleto do cabeçalho, do mês e das abas. */
export function FichaDaOperacaoCarregando() {
  return (
    <div
      role="status"
      aria-label="Carregando a ficha da operação"
      className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8"
    >
      <span className="sr-only">Carregando a ficha da operação</span>
      <div aria-hidden className="flex flex-col gap-5">
        <span className="bg-muted block h-5 w-28 animate-pulse rounded" />
        <span className="bg-muted block h-10 w-72 animate-pulse rounded" />
        <span className="bg-muted block h-9 w-full animate-pulse rounded-lg" />
        <span className="bg-muted block h-64 max-w-2xl animate-pulse rounded-xl" />
      </div>
    </div>
  );
}
