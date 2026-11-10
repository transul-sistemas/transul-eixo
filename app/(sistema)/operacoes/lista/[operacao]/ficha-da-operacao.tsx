import { connection } from "next/server";
import { AbasDaFichaNaUrl } from "@/components/ficha/abas-da-ficha-na-url";
import { CabecalhoDaFicha } from "@/components/ficha/cabecalho-da-ficha";
import { FichaDaRaiz } from "@/components/ficha/ficha-da-raiz";
import { SeletorDePeriodo } from "@/components/ficha/seletor-de-periodo";
import { formatarData, formatarMes } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro, formatarPercentual } from "@/components/formato/numero";
import { Grafico } from "@/components/grafico/grafico";
import { GraficoDeArvore } from "@/components/grafico/grafico-de-arvore";
import { GraficoDeCascata } from "@/components/grafico/grafico-de-cascata";
import { GraficoDeRosca } from "@/components/grafico/grafico-de-rosca";
import { CelulaDaGrade, GradeDePaineis } from "@/components/layout/grade-de-paineis";
import { FaixaDeKpis, type Kpi } from "@/components/layout/faixa-de-kpis";
import { PainelDeGrafico } from "@/components/layout/painel-de-grafico";
import { ListaVazia } from "@/components/tabela/estados";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerFichaDaOperacao } from "@/lib/dados/operacoes";
import {
  lerContextoDaOperacao,
  lerMesFechado,
  lerResultadoDaOperacao,
} from "@/lib/dados/operacoes-ficha";
import {
  type ContextoDaOperacao,
  type FichaDaOperacao,
  NOMES_DOS_TIPOS_DE_OPERACAO,
  type ResultadoDoPeriodo,
} from "@/lib/dados/operacoes-tipos";
import {
  intervaloDoPeriodo,
  lerPeriodo,
  mesesDoIntervalo,
  chipsDeMes,
  somarMeses,
  variacaoPercentual,
} from "@/lib/dominio/periodo";
import { arvoreDaOperacao, textoDoEvento } from "@/lib/dominio/mapa-da-operacao";
import { passosDaCascata, semLancamentos } from "@/lib/dominio/resultado-da-operacao";
import { lerAba } from "@/lib/navegacao/ficha";
import {
  ABAS_DA_OPERACAO,
  type AbaDaOperacao,
  IDS_DAS_ABAS_DA_OPERACAO,
} from "@/lib/navegacao/operacoes";
import { temPermissao } from "@/lib/seguranca/exigir-permissao";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import type { Status } from "@/lib/visual/tons";
import { EditarOperacao } from "../editar-operacao";
import { paraParametros, type ParametrosDaBusca } from "../pagina-de-operacoes";
import {
  TabelaDasFiliais,
  TabelaDasFuncoes,
  TabelaDasNaturezas,
  TabelaDasPessoas,
  TabelaDasPlacas,
  TabelaDosMeses,
} from "./tabelas-da-ficha";
import { VoltarALista } from "./voltar-a-lista";

// A ficha da operação, com todas as abas. Os números de dinheiro vêm prontos do banco
// (nucleo.resultado_da_operacao, nucleo.ficha_da_operacao); pessoas, linha do tempo, mapa e árvore
// vêm de nucleo.contexto_da_operacao. Onde não há fonte (receita e despesa do staging vazio, ou a aba
// Documentos), a tela diz "Sem dados ainda: depende de ..." e nunca mostra R$ 0,00 como resultado.

const SEM_RESULTADO = "Sem dados ainda: depende da ponte do Sankhya (viagens e despesas).";
const SEM_DOCUMENTOS =
  "Sem dados ainda: depende do módulo de documentos da operação (contratos), que ainda não tem fonte.";

const NOMES_DOS_GRUPOS: Record<Status, string> = {
  "em-atividade": "Em atividade",
  atencao: "Atenção",
  impedida: "Impedida",
  patio: "Pátio",
  fora: "Fora",
};

function kpisDoResumo(r: ResultadoDoPeriodo, contra: string, semDados: boolean): Kpi[] {
  const a = r.atual;
  const b = r.anterior;
  const itens: {
    id: string;
    rotulo: string;
    valor: Kpi["valor"];
    variacao?: Kpi["variacao"];
    apoio?: string;
  }[] = [
    {
      id: "receita",
      rotulo: "Receita",
      valor: <Moeda valor={a.receitaCentavos} />,
      variacao: { pontos: variacaoPercentual(a.receitaCentavos, b.receitaCentavos), contra },
    },
    {
      id: "frota",
      rotulo: "Custo da frota",
      valor: <Moeda valor={a.custoFrotaCentavos} />,
      variacao: {
        pontos: variacaoPercentual(a.custoFrotaCentavos, b.custoFrotaCentavos),
        bomQuando: "cair",
        contra,
      },
    },
    {
      id: "servico",
      rotulo: "Custo de serviço e pessoal",
      valor: <Moeda valor={a.custoServicoCentavos} />,
      variacao: {
        pontos: variacaoPercentual(a.custoServicoCentavos, b.custoServicoCentavos),
        bomQuando: "cair",
        contra,
      },
    },
    {
      id: "margem",
      rotulo: "Margem",
      valor: <Moeda valor={a.margemCentavos} />,
      variacao: { pontos: variacaoPercentual(a.margemCentavos, b.margemCentavos), contra },
    },
    {
      id: "margem-percentual",
      rotulo: "Margem %",
      valor: a.margemPercentual === null ? "—" : formatarPercentual(a.margemPercentual),
      apoio: a.margemPercentual === null ? "Sem receita no período" : "da receita",
    },
    {
      id: "receita-por-placa",
      rotulo: "Receita por placa",
      valor: a.receitaPorPlacaCentavos === null ? "—" : <Moeda valor={a.receitaPorPlacaCentavos} />,
      variacao: {
        pontos: variacaoPercentual(a.receitaPorPlacaCentavos, b.receitaPorPlacaCentavos),
        contra,
      },
      apoio: `${formatarInteiro(a.placas)} ${a.placas === 1 ? "placa" : "placas"} no período`,
    },
  ];
  return itens.map((k) =>
    semDados ? { id: k.id, rotulo: k.rotulo, valor: null, semDados: SEM_RESULTADO } : k,
  );
}

function SemAcessoAoResultado() {
  return (
    <p className="text-muted-foreground text-sm" data-testid="sem-resultado">
      O resultado em R$ aparece para quem tem acesso a Resultados.
    </p>
  );
}

function Resumo({
  resultado,
  periodo,
  rotuloDoPeriodo,
  contra,
  semDados,
}: {
  resultado: ResultadoDoPeriodo | null;
  periodo: "mes" | "acumulado";
  rotuloDoPeriodo: string;
  contra: string;
  semDados: boolean;
}) {
  if (!resultado) return <SemAcessoAoResultado />;
  const estado = semDados ? "vazio" : "ok";
  const passos = passosDaCascata(resultado.atual);
  const naturezas = [
    ...resultado.frotaPorNatureza.map((n) => ({
      nome: `Frota: ${n.natureza}`,
      valor: n.valorCentavos,
    })),
    ...resultado.servicoPorNatureza.map((n) => ({
      nome: `Serviço: ${n.natureza}`,
      valor: n.valorCentavos,
    })),
  ];
  return (
    <div className="flex flex-col gap-4">
      <FaixaDeKpis kpis={kpisDoResumo(resultado, contra, semDados)} />
      <GradeDePaineis>
        <CelulaDaGrade colunas={12}>
          <PainelDeGrafico
            titulo="Evolução de 12 meses"
            descricao="Receita, custos e margem mês a mês, pela competência gerencial."
            estado={estado}
            textoVazio={SEM_RESULTADO}
            alturaMinima={320}
          >
            <Grafico
              rotulo="Evolução de 12 meses: receita, custo da frota, custo de serviço e margem"
              categorias={resultado.serie.map((p) => formatarMes(p.mes))}
              series={[
                {
                  nome: "Receita",
                  tipo: "barra",
                  cor: { modulo: "operacoes" },
                  valores: resultado.serie.map((p) => p.receitaCentavos),
                },
                {
                  nome: "Custo da frota",
                  tipo: "barra",
                  cor: "negativo",
                  pilha: "custo",
                  valores: resultado.serie.map((p) => p.custoFrotaCentavos),
                },
                {
                  nome: "Custo de serviço e pessoal",
                  tipo: "barra",
                  cor: { modulo: "cadastros" },
                  pilha: "custo",
                  valores: resultado.serie.map((p) => p.custoServicoCentavos),
                },
                {
                  nome: "Margem",
                  tipo: "linha",
                  cor: "acao",
                  valores: resultado.serie.map((p) => p.margemCentavos),
                },
              ]}
              formatos={["moeda"]}
              altura={300}
            />
          </PainelDeGrafico>
        </CelulaDaGrade>
        <CelulaDaGrade colunas={6}>
          <PainelDeGrafico
            titulo={`Cascata de ${rotuloDoPeriodo}`}
            descricao="Receita menos os custos da frota e de serviço dá a margem."
            estado={estado}
            textoVazio={SEM_RESULTADO}
          >
            <GraficoDeCascata
              rotulo={`Cascata de ${rotuloDoPeriodo}: receita, custos e margem`}
              passos={passos}
            />
          </PainelDeGrafico>
        </CelulaDaGrade>
        <CelulaDaGrade colunas={6}>
          <PainelDeGrafico
            titulo="Custo por natureza"
            descricao="As maiores naturezas de despesa do período, frota e serviço."
            estado={semDados || naturezas.length === 0 ? "vazio" : "ok"}
            textoVazio={semDados ? SEM_RESULTADO : "Nenhuma despesa no período."}
          >
            <GraficoDeRosca rotulo="Custo por natureza" fatias={naturezas} formato="moeda" />
          </PainelDeGrafico>
        </CelulaDaGrade>
        {periodo === "mes" ? (
          <CelulaDaGrade colunas={12}>
            <PainelDeGrafico
              titulo="Dia a dia do mês"
              descricao="Receita no dia da negociação; despesa no dia do lançamento da competência."
              estado={estado}
              textoVazio={SEM_RESULTADO}
            >
              <Grafico
                rotulo="Receita e custo dia a dia dentro do mês"
                categorias={resultado.dias.map((d) => d.dia.slice(8, 10))}
                series={[
                  {
                    nome: "Receita",
                    tipo: "linha",
                    cor: { modulo: "operacoes" },
                    area: true,
                    valores: resultado.dias.map((d) => d.receitaCentavos),
                  },
                  {
                    nome: "Custo",
                    tipo: "linha",
                    cor: "negativo",
                    valores: resultado.dias.map((d) => d.custoCentavos),
                  },
                ]}
                formatos={["moeda"]}
                altura={240}
              />
            </PainelDeGrafico>
          </CelulaDaGrade>
        ) : null}
      </GradeDePaineis>
    </div>
  );
}

function Placas({ ficha }: { ficha: FichaDaOperacao }) {
  if (ficha.placas.length === 0) {
    return (
      <ListaVazia
        titulo="Nenhuma placa vinculada agora"
        descricao="As placas aparecem aqui quando forem montadas nesta operação (Frota › Placas)."
      />
    );
  }
  // As placas já vêm do banco com a situação; só se agrupam por grupo para a rosca.
  const porGrupo = new Map<Status, number>();
  for (const p of ficha.placas) porGrupo.set(p.grupo, (porGrupo.get(p.grupo) ?? 0) + 1);
  const fatias = [...porGrupo.entries()].map(([status, valor]) => ({
    nome: NOMES_DOS_GRUPOS[status],
    valor,
    status,
  }));
  return (
    <GradeDePaineis>
      <CelulaDaGrade colunas={4}>
        <PainelDeGrafico titulo="Situação das placas" descricao="Como estão agora.">
          <GraficoDeRosca
            rotulo="Situação das placas da operação"
            fatias={fatias}
            formato="inteiro"
          />
        </PainelDeGrafico>
      </CelulaDaGrade>
      <CelulaDaGrade colunas={8}>
        <PainelDeGrafico titulo="Placas vinculadas agora" alturaMinima={120}>
          <TabelaDasPlacas placas={ficha.placas} />
        </PainelDeGrafico>
      </CelulaDaGrade>
    </GradeDePaineis>
  );
}

function Pessoas({ ficha, contexto }: { ficha: FichaDaOperacao; contexto: ContextoDaOperacao }) {
  const p = ficha.pessoas;
  return (
    <div className="flex flex-col gap-4">
      {!contexto.vePessoas ? (
        <p className="text-muted-foreground text-sm">
          Os nomes aparecem para quem tem acesso a Pessoas. Aqui só a função e a escala.
        </p>
      ) : null}
      {contexto.pessoas.length === 0 ? (
        <ListaVazia
          titulo="Ninguém vinculado agora"
          descricao="As pessoas aparecem aqui quando houver vínculo vigente com a operação (Pessoas › Pessoas)."
        />
      ) : (
        <PainelDeGrafico
          titulo={`Função e escala de ${formatarMes(contexto.mes)}`}
          alturaMinima={120}
        >
          <TabelaDasFuncoes funcoes={contexto.pessoas} />
        </PainelDeGrafico>
      )}
      {p ? (
        <PainelDeGrafico
          titulo={`Folha de ${formatarMes(ficha.mes)}`}
          descricao="Funcionários e salário bruto dos CRs da operação, por departamento."
          estado={p.funcionarios === 0 ? "vazio" : "ok"}
          textoVazio="Sem dados ainda: depende da folha do mês (ponte do Sankhya)."
          alturaMinima={120}
        >
          <TabelaDasPessoas pessoas={p} />
        </PainelDeGrafico>
      ) : null}
    </div>
  );
}

function ResultadoDoPeriodo({
  resultado,
  semDados,
}: {
  resultado: ResultadoDoPeriodo | null;
  semDados: boolean;
}) {
  if (!resultado) return <SemAcessoAoResultado />;
  const meses = [...resultado.mesesDoPeriodo].reverse();
  return (
    <GradeDePaineis>
      <CelulaDaGrade colunas={12}>
        <PainelDeGrafico
          titulo="Margem mês a mês"
          estado={semDados ? "vazio" : "ok"}
          textoVazio={SEM_RESULTADO}
        >
          <Grafico
            rotulo="Margem mês a mês no período"
            categorias={resultado.mesesDoPeriodo.map((p) => formatarMes(p.mes))}
            series={[
              {
                nome: "Margem",
                tipo: "barra",
                cor: { modulo: "operacoes" },
                valores: resultado.mesesDoPeriodo.map((p) => p.margemCentavos),
              },
            ]}
            formatos={["moeda"]}
            altura={260}
          />
        </PainelDeGrafico>
      </CelulaDaGrade>
      <CelulaDaGrade colunas={12}>
        <PainelDeGrafico
          titulo="Resultado por mês"
          estado={semDados ? "vazio" : "ok"}
          textoVazio={SEM_RESULTADO}
          alturaMinima={120}
        >
          <TabelaDosMeses meses={meses} />
        </PainelDeGrafico>
      </CelulaDaGrade>
      <CelulaDaGrade colunas={6}>
        <PainelDeGrafico
          titulo="Custos da frota por natureza"
          estado={resultado.frotaPorNatureza.length === 0 ? "vazio" : "ok"}
          textoVazio={semDados ? SEM_RESULTADO : "Nenhuma despesa de frota no período."}
          alturaMinima={120}
        >
          <TabelaDasNaturezas
            rotulo="Custos da frota por natureza"
            naturezas={resultado.frotaPorNatureza}
          />
        </PainelDeGrafico>
      </CelulaDaGrade>
      <CelulaDaGrade colunas={6}>
        <PainelDeGrafico
          titulo="Custos de serviço por natureza"
          estado={resultado.servicoPorNatureza.length === 0 ? "vazio" : "ok"}
          textoVazio={semDados ? SEM_RESULTADO : "Nenhuma despesa de serviço no período."}
          alturaMinima={120}
        >
          <TabelaDasNaturezas
            rotulo="Custos de serviço por natureza"
            naturezas={resultado.servicoPorNatureza}
          />
        </PainelDeGrafico>
      </CelulaDaGrade>
    </GradeDePaineis>
  );
}

function LinhaDoTempoDaOperacao({ contexto }: { contexto: ContextoDaOperacao }) {
  if (contexto.linhaDoTempo.length === 0) {
    return (
      <ListaVazia
        titulo="Nenhum evento ainda"
        descricao="Entradas e saídas de placas, CRs montados e pessoas vinculadas aparecem aqui."
      />
    );
  }
  return (
    <PainelDeGrafico
      titulo="Eventos da operação"
      descricao="Do mais recente ao mais antigo. Pessoas aparecem só pela função, sem nome."
      alturaMinima={120}
    >
      <ol aria-label="Eventos da operação" className="divide-border flex flex-col divide-y">
        {contexto.linhaDoTempo.map((e, i) => (
          <li key={`${e.quando}-${e.tipo}-${e.objeto}-${i}`} className="flex gap-4 py-2 text-sm">
            <time dateTime={e.quando} className="text-muted-foreground w-24 shrink-0 tabular-nums">
              {formatarData(e.quando)}
            </time>
            <span>{textoDoEvento(e)}</span>
          </li>
        ))}
      </ol>
    </PainelDeGrafico>
  );
}

function MapaDaOperacao({ contexto }: { contexto: ContextoDaOperacao }) {
  const { base, filiais } = contexto.mapa;
  const baseTexto = [base.cidade, base.uf].filter(Boolean).join("/");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Base da operação: {baseTexto || "sem base"}
        {base.filial ? ` (garagem ${base.filial})` : ""}. Esta aba mostra as bases e a distribuição
        das placas; não há telemetria, então não mostra posição ao vivo.
      </p>
      {filiais.length === 0 ? (
        <ListaVazia
          titulo="Nenhuma placa para distribuir"
          descricao="As placas aparecem aqui por filial quando forem montadas nesta operação."
        />
      ) : (
        <GradeDePaineis>
          <CelulaDaGrade colunas={5}>
            <PainelDeGrafico titulo="Placas por filial">
              <Grafico
                rotulo="Placas da operação por filial"
                categorias={filiais.map((f) => f.filial)}
                series={[
                  {
                    nome: "Placas",
                    tipo: "barra",
                    cor: { modulo: "operacoes" },
                    valores: filiais.map((f) => f.placas),
                  },
                ]}
                formatos={["inteiro"]}
                deitado
                altura={220}
              />
            </PainelDeGrafico>
          </CelulaDaGrade>
          <CelulaDaGrade colunas={7}>
            <PainelDeGrafico titulo="Bases e filiais" alturaMinima={120}>
              <TabelaDasFiliais filiais={filiais} />
            </PainelDeGrafico>
          </CelulaDaGrade>
        </GradeDePaineis>
      )}
    </div>
  );
}

function MapaMental({ ficha, contexto }: { ficha: FichaDaOperacao; contexto: ContextoDaOperacao }) {
  const raiz = arvoreDaOperacao({
    operacao: ficha.operacao.nome,
    crs: contexto.arvore.crs,
    placasSemCr: contexto.arvore.placasSemCr,
    pessoas: contexto.pessoas,
  });
  if (!raiz.filhos) {
    return (
      <ListaVazia
        titulo="Nada ligado à operação ainda"
        descricao="A árvore aparece quando a operação tiver CRs, placas ou pessoas vinculadas."
      />
    );
  }
  return (
    <PainelDeGrafico
      titulo="Operação, frota, serviço, CRs, placas e pessoas"
      descricao="Dados reais de hoje. Clique em um ramo para recolher ou abrir."
      alturaMinima={520}
    >
      <GraficoDeArvore rotulo={`Mapa mental da operação ${ficha.operacao.nome}`} raiz={raiz} />
    </PainelDeGrafico>
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
  // O mês padrão é o mês fechado mais recente (e não o último com viagem no staging da v1).
  const mesFechado = await lerMesFechado();
  const periodo = lerPeriodo(parametros, mesFechado);
  const intervalo = intervaloDoPeriodo(periodo, mesFechado, somarMeses(mesFechado, -23));
  const mesesDoPeriodo = mesesDoIntervalo(intervalo);
  const mesDaFicha = periodo.tipo === "mes" ? periodo.mes : (mesesDoPeriodo.at(-1) ?? mesFechado);
  const [ficha, resultado, contexto] = await Promise.all([
    lerFichaDaOperacao(id, mesDaFicha),
    lerResultadoDaOperacao(id, intervalo),
    lerContextoDaOperacao(id, mesDaFicha),
  ]);
  if (!ficha || !contexto) {
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
  const semDados =
    resultado !== null &&
    semLancamentos([
      ...resultado.serie,
      ...resultado.mesesDoPeriodo,
      resultado.atual,
      resultado.anterior,
    ]);
  const rotuloDoPeriodo =
    periodo.tipo === "mes"
      ? formatarMes(periodo.mes)
      : `${formatarMes(mesesDoPeriodo[0])} a ${formatarMes(mesesDoPeriodo.at(-1))}`;
  const contra = periodo.tipo === "mes" ? "o mês anterior" : "o período anterior";

  const conteudos: Record<AbaDaOperacao, React.ReactNode> = {
    resumo: (
      <Resumo
        resultado={resultado}
        periodo={periodo.tipo}
        rotuloDoPeriodo={rotuloDoPeriodo}
        contra={contra}
        semDados={semDados}
      />
    ),
    placas: <Placas ficha={ficha} />,
    pessoas: <Pessoas ficha={ficha} contexto={contexto} />,
    resultado: <ResultadoDoPeriodo resultado={resultado} semDados={semDados} />,
    "linha-do-tempo": <LinhaDoTempoDaOperacao contexto={contexto} />,
    documentos: (
      <PainelDeGrafico titulo="Documentos da operação" estado="vazio" textoVazio={SEM_DOCUMENTOS} />
    ),
    mapa: <MapaDaOperacao contexto={contexto} />,
    "mapa-mental": <MapaMental ficha={ficha} contexto={contexto} />,
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
        <SeletorDePeriodo
          rota={`/operacoes/lista/${operacao.id}`}
          parametros={parametros}
          meses={chipsDeMes(mesFechado)}
          atual={periodo}
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

/** O que se vê enquanto a ficha chega: o esqueleto do cabeçalho, do período e das abas. */
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
        <span className="bg-muted block h-64 w-full animate-pulse rounded-xl" />
      </div>
    </div>
  );
}
