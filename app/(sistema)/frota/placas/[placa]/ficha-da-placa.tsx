import { Etiqueta } from "@/components/etiqueta";
import { agoraEmSaoPaulo, formatarData, formatarDataEHora } from "@/components/formato/data";
import { formatarDuracao } from "@/components/formato/duracao";
import { AbaEmBreve } from "@/components/ficha/aba-em-breve";
import { AbasDaFichaNaUrl } from "@/components/ficha/abas-da-ficha-na-url";
import { CabecalhoDaFicha } from "@/components/ficha/cabecalho-da-ficha";
import { EventosDaFicha } from "@/components/ficha/eventos-da-ficha";
import { FichaDaRaiz } from "@/components/ficha/ficha-da-raiz";
import { LinhaDoTempo } from "@/components/ficha/linha-do-tempo";
import { Placa } from "@/components/placa";
import { haDias, SecoesDoResumo } from "@/components/tabela/resumo-da-placa";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import { NOMES_DOS_TIPOS, obterFicha } from "@/lib/dados/placas";
import { idsDasAcoesDoMomento } from "@/lib/dominio/acoes-do-momento";
import { somarDias } from "@/lib/dominio/dias";
import { segmentosDaLinhaDoTempo } from "@/lib/dominio/linha-do-tempo";
import { SIGLAS_DE_BAIXA } from "@/lib/dominio/status";
import { ACOES, podeVerAcao } from "@/lib/navegacao/acoes";
import { type AbaId, lerAba } from "@/lib/navegacao/ficha";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { connection } from "next/server";
import { type ParametrosDaBusca, paraParametros, simulacaoDe } from "../pagina-de-placas";
import { PlacaNaoEncontradaNaFicha } from "./placa-nao-encontrada";
import { VoltarALista } from "./voltar-a-lista";
import { AssistentesDaFrota } from "../assistentes/assistentes-da-frota";
import { AcoesEmBreve } from "../assistentes/acoes-em-breve";
import { carregarDadosDosAssistentes } from "../assistentes/carregar-dados";

/** A janela da faixa colorida: os últimos 30 dias, até agora. */
const DIAS_DA_JANELA = 30;

const hrefDaFicha = (placa: string) => `/frota/placas/${placa}`;

/** A ficha da placa: cabeçalho, linha do tempo pela régua e as seis abas (duas com conteúdo). */
export async function FichaDaPlaca({
  placa,
  searchParams,
}: {
  placa: string;
  searchParams: ParametrosDaBusca;
}) {
  await connection();
  const { perfil } = await exigirSessao();
  const parametros = paraParametros(await searchParams);
  const hoje = hojeEmSaoPaulo(new Date());
  const ficha = await obterFicha(placa, hoje, { simulacao: simulacaoDe(parametros) });
  if (!ficha) return <PlacaNaoEncontradaNaFicha placa={placa} />;

  // Em dado real nenhum evento está no futuro; o exemplo pode ter um de hoje depois da hora de agora.
  const ultimo = ficha.eventos.at(-1)?.em ?? "";
  const agora = [agoraEmSaoPaulo(new Date()), ultimo].sort().at(-1) as string;
  const janela = { de: `${somarDias(hoje, -DIAS_DA_JANELA)}T00:00`, ate: agora };
  const faixas = segmentosDaLinhaDoTempo(ficha.eventos, janela, agora);
  const primeiro = ficha.eventos[0]?.em ?? janela.de;
  const historico = segmentosDaLinhaDoTempo(ficha.eventos, { de: primeiro, ate: agora }, agora)
    .reverse()
    .map((s) => ({
      chave: s.de,
      quando: formatarDataEHora(s.de),
      situacao:
        s.sigla && s.grupo ? (
          <Etiqueta status={s.grupo}>
            <span className="font-semibold">{s.sigla}</span>
          </Etiqueta>
        ) : null,
      duracao: formatarDuracao(s.minutos),
    }));

  const baixada = SIGLAS_DE_BAIXA.includes(ficha.sigla);
  const dadosDosAssistentes = await carregarDadosDosAssistentes({
    assistente: parametros.get("assistente"),
    placa: ficha.placa,
    hoje,
    carregarDaPlaca: true,
  });
  const acoes = idsDasAcoesDoMomento({
    sigla: ficha.sigla,
    tipo: ficha.tipo,
    pedidoPendente: dadosDosAssistentes !== "em-breve" && dadosDosAssistentes?.pedido != null,
  })
    .map((id) => ACOES.find((acao) => acao.id === id))
    .filter((acao) => acao !== undefined)
    .filter((acao) => podeVerAcao(perfil, acao))
    .map(({ id, nome }) => ({ id, nome }));

  const conteudos: Record<AbaId, React.ReactNode> = {
    resumo: <SecoesDoResumo detalhe={ficha} hrefDaPlaca={hrefDaFicha} disposicao="grade" />,
    "linha-do-tempo": <EventosDaFicha linhas={historico} />,
    documentos: (
      <AbaEmBreve
        nome="Documentos"
        descricao="Guarda o CRLV, o seguro e os demais documentos da placa, com o vencimento de cada um."
        modulo="frota"
      />
    ),
    resultado: (
      <AbaEmBreve
        nome="Resultado"
        descricao="Mostra o resultado da placa por competência: receitas, despesas e margem."
        modulo="frota"
      />
    ),
    mapa: (
      <AbaEmBreve
        nome="Mapa"
        descricao="Mostra onde a placa está e por onde andou."
        modulo="frota"
      />
    ),
    "mapa-mental": (
      <AbaEmBreve
        nome="Mapa mental"
        descricao="Mostra a placa ligada ao conjunto, ao gestor, à operação e ao motorista."
        modulo="frota"
      />
    ),
  };

  return (
    <FichaDaRaiz
      cabecalho={
        <CabecalhoDaFicha
          voltar={<VoltarALista />}
          titulo={
            <>
              <span className="sr-only">{ficha.placa}</span>
              <span aria-hidden>
                <Placa placa={ficha.placa} tamanho="g" />
              </span>
            </>
          }
          subtitulo={`${ficha.modelo}, ${NOMES_DOS_TIPOS[ficha.tipo].toLowerCase()}${
            ficha.ano !== null ? `, ano ${ficha.ano}` : ""
          }`}
          situacao={
            <>
              <Etiqueta status={ficha.grupo} titulo={ficha.nomeDaSituacao}>
                <span className="font-semibold">{ficha.sigla}</span>
                <span>{ficha.nomeDaSituacao}</span>
              </Etiqueta>
              <span className="text-muted-foreground text-sm">
                {haDias(ficha.diasNoStatus)}, desde {formatarDataEHora(ficha.desde)}
              </span>
            </>
          }
          aviso={
            baixada
              ? `Placa baixada: ${ficha.nomeDaSituacao} desde ${formatarData(ficha.desde)}. Fica aqui só para consulta.`
              : undefined
          }
          acoes={
            // Sempre montado: depois de gravar, as ações do momento mudam (ou somem) e o assistente
            // aberto não pode desmontar junto com elas.
            dadosDosAssistentes === "em-breve" ? (
              <AcoesEmBreve acoesDaFicha={acoes} />
            ) : dadosDosAssistentes ? (
              <AssistentesDaFrota
                dados={dadosDosAssistentes}
                placaDaFicha={ficha.placa}
                acoesDaFicha={acoes}
              />
            ) : undefined
          }
        />
      }
      linhaDoTempo={
        <LinhaDoTempo segmentos={faixas} de={janela.de} ate={janela.ate} nome={ficha.placa} />
      }
    >
      <AbasDaFichaNaUrl abaInicial={lerAba(parametros)} conteudos={conteudos} />
    </FichaDaRaiz>
  );
}

/** O que se vê enquanto a ficha chega: o esqueleto do cabeçalho, da faixa e das abas. */
export function FichaDaPlacaCarregando({ placa }: { placa: string }) {
  return (
    <div
      role="status"
      aria-label={`Carregando a ficha da placa ${placa}`}
      className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8"
    >
      <span className="sr-only">Carregando a ficha da placa {placa}</span>
      <div aria-hidden className="flex flex-col gap-5">
        <span className="bg-muted block h-5 w-28 animate-pulse rounded" />
        <div className="flex flex-col gap-2">
          <span className="bg-muted block h-10 w-40 animate-pulse rounded" />
          <span className="bg-muted block h-4 w-64 animate-pulse rounded" />
          <span className="bg-muted block h-6 w-72 animate-pulse rounded-full" />
        </div>
        <span className="bg-muted block h-9 w-full animate-pulse rounded-lg" />
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="bg-muted block h-8 w-24 animate-pulse rounded" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className="bg-muted block h-40 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
