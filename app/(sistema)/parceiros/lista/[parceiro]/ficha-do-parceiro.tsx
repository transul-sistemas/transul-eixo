import Link from "next/link";
import { connection } from "next/server";
import { AbaEmBreve } from "@/components/ficha/aba-em-breve";
import { AbasDaFichaNaUrl } from "@/components/ficha/abas-da-ficha-na-url";
import { CabecalhoDaFicha } from "@/components/ficha/cabecalho-da-ficha";
import { FichaDaRaiz } from "@/components/ficha/ficha-da-raiz";
import { Etiqueta } from "@/components/etiqueta";
import { formatarData, formatarMes } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro } from "@/components/formato/numero";
import { Placa } from "@/components/placa";
import { ListaVazia } from "@/components/tabela/estados";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerFichaDoParceiro } from "@/lib/dados/parceiros";
import type { FichaDoParceiro, OrigemDaPlaca } from "@/lib/dados/parceiros-tipos";
import { NOMES_DOS_TIPOS_DE_PARCEIRO } from "@/lib/dominio/esquemas/parceiros";
import { lerAba } from "@/lib/navegacao/ficha";
import { lerMes } from "@/lib/navegacao/operacoes";
import {
  ABAS_DO_PARCEIRO,
  type AbaDoParceiro,
  enderecoDaConciliacao,
  IDS_DAS_ABAS_DO_PARCEIRO,
} from "@/lib/navegacao/parceiros";
import {
  paraParametros,
  type ParametrosDaBusca,
  SeletorDeMes,
} from "../../../operacoes/lista/pagina-de-operacoes";
import { VoltarALista } from "./voltar-a-lista";

// A ficha do parceiro (primeira versão): cabeçalho com os tipos e o agrupador, o mês e as abas
// (Resumo com os totais e as situações da conciliação, Placas vinculadas agora e Locações; as demais
// em breve). Tudo pronto do banco (nucleo.ficha_do_parceiro).

const NOMES_DAS_ORIGENS: Record<OrigemDaPlaca, string> = {
  cr_de_acionista: "CR de acionista",
  posse: "Posse",
  locacao: "Locação",
};

const TH = "px-3 py-2 text-left font-medium";

function Resumo({ ficha }: { ficha: FichaDoParceiro }) {
  const t = ficha.totais;
  if (!t) {
    return (
      <ListaVazia
        titulo="Sem agrupador do Sankhya"
        descricao="Este parceiro não tem agrupador: a despesa, a receita e a conciliação aparecem quando ele tiver."
      />
    );
  }
  const linhas: [string, React.ReactNode][] = [
    ["Despesa do mês", <Moeda key="d" valor={t.despesaCentavos} />],
    ["Receita do mês", <Moeda key="r" valor={t.receitaCentavos} />],
    ["CRs com placa ou lançamento", formatarInteiro(t.crs)],
    ["Conferem", formatarInteiro(t.confere)],
    ["Com diferença", formatarInteiro(t.diferenca)],
    ["Sem lançamento", formatarInteiro(t.semLancamento)],
  ];
  return (
    <section className="border-border bg-card flex max-w-2xl flex-col gap-3 rounded-xl border p-5">
      <h3 className="text-base font-semibold">Resumo de {formatarMes(ficha.mes)}</h3>
      <dl aria-label="Resumo do mês" className="flex flex-col gap-2">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-baseline justify-between gap-4">
            <dt>{rotulo}</dt>
            <dd className="tabular-nums">{valor}</dd>
          </div>
        ))}
      </dl>
      {ficha.parceiro.agrupador ? (
        <Link
          href={enderecoDaConciliacao({
            mes: ficha.mes,
            agrupador: ficha.parceiro.agrupador.id,
            situacao: "todas",
          })}
          className="text-sm underline underline-offset-4"
        >
          Abrir a conciliação do mês
        </Link>
      ) : null}
    </section>
  );
}

function Placas({ ficha }: { ficha: FichaDoParceiro }) {
  if (ficha.placas.length === 0) {
    return (
      <ListaVazia
        titulo="Nenhuma placa vinculada agora"
        descricao="As placas aparecem aqui pelo CR de acionista do agrupador, pela posse ou pela locação."
      />
    );
  }
  return (
    <div className="border-border bg-card relative overflow-x-auto rounded-xl border">
      <table className="w-full text-sm" aria-label="Placas do parceiro">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th scope="col" className={TH}>
              Placa
            </th>
            <th scope="col" className={TH}>
              Tipo
            </th>
            <th scope="col" className={TH}>
              Modelo
            </th>
            <th scope="col" className={TH}>
              Vínculo
            </th>
          </tr>
        </thead>
        <tbody>
          {ficha.placas.map((p) => (
            <tr key={p.ativoId} className="border-border border-t">
              <th scope="row" className="px-3 py-2 text-left font-normal">
                <Placa placa={p.placa} tamanho="p" />
              </th>
              <td className="px-3 py-2">{p.tipo}</td>
              <td className="px-3 py-2">{p.modelo ?? "—"}</td>
              <td className="px-3 py-2">{p.origens.map((o) => NOMES_DAS_ORIGENS[o]).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Locacoes({ ficha }: { ficha: FichaDoParceiro }) {
  if (ficha.locacoes.length === 0) {
    return (
      <ListaVazia
        titulo="Nenhuma locação"
        descricao="As locações do parceiro aparecem aqui. Cadastre em Parceiros › Locação."
      />
    );
  }
  return (
    <div className="border-border bg-card relative overflow-x-auto rounded-xl border">
      <table className="w-full text-sm" aria-label="Locações do parceiro">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th scope="col" className={TH}>
              Placa
            </th>
            <th scope="col" className={TH}>
              Início
            </th>
            <th scope="col" className={TH}>
              Fim
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Valor mensal
            </th>
            <th scope="col" className={TH}>
              Situação
            </th>
          </tr>
        </thead>
        <tbody>
          {ficha.locacoes.map((l) => (
            <tr key={l.id} className="border-border border-t">
              <th scope="row" className="px-3 py-2 text-left font-normal">
                <Placa placa={l.placa} tamanho="p" />
              </th>
              <td className="px-3 py-2 tabular-nums">{formatarData(l.inicio)}</td>
              <td className="px-3 py-2 tabular-nums">{l.fim ? formatarData(l.fim) : "—"}</td>
              <td className="px-3 py-2">
                <Moeda valor={l.valorMensalCentavos} />
              </td>
              <td className="px-3 py-2">{l.vigente ? "Vigente" : "Fora de vigência"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A ficha do parceiro. Sem o parceiro, o aviso com o caminho de volta. */
export async function FichaDoParceiroNaTela({
  id,
  searchParams,
}: {
  id: string;
  searchParams: ParametrosDaBusca;
}) {
  await connection();
  const parametros = paraParametros(await searchParams);
  if (modoDosDados() !== "banco") {
    return (
      <div className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
        <VoltarALista />
        <ListaVazia
          titulo="A ficha do parceiro lê só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco."
        />
      </div>
    );
  }
  const ficha = await lerFichaDoParceiro(id, lerMes(parametros));
  if (!ficha) {
    return (
      <div className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
        <VoltarALista />
        <h1 className="text-3xl font-semibold tracking-tight">Parceiro não encontrado</h1>
        <ListaVazia
          titulo="Este parceiro não está ao seu alcance"
          descricao="Ele pode ter sido arquivado. Volte à lista e procure de novo."
        />
      </div>
    );
  }

  const { parceiro } = ficha;
  const emBreve = (nome: string, descricao: string) => (
    <AbaEmBreve nome={nome} descricao={descricao} modulo="parceiros" />
  );
  const conteudos: Record<AbaDoParceiro, React.ReactNode> = {
    resumo: <Resumo ficha={ficha} />,
    placas: <Placas ficha={ficha} />,
    locacoes: <Locacoes ficha={ficha} />,
    "linha-do-tempo": emBreve(
      "Linha do tempo",
      "Mostra as placas e os contratos do parceiro ao longo do tempo.",
    ),
    documentos: emBreve("Documentos", "Guarda os contratos e os documentos do parceiro."),
    resultado: emBreve(
      "Resultado",
      "Mostra o resultado do parceiro mês a mês, com o livro do acionista.",
    ),
    mapa: emBreve("Mapa", "Mostra onde estão as placas do parceiro."),
    "mapa-mental": emBreve(
      "Mapa mental",
      "Mostra o parceiro ligado às placas, aos CRs e às operações.",
    ),
  };
  const sankhya = [
    parceiro.codparc !== null ? `CODPARC ${parceiro.codparc}` : null,
    parceiro.agrupador ? `agrupador ${parceiro.agrupador.codigo}` : "sem agrupador",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <FichaDaRaiz
      cabecalho={
        <CabecalhoDaFicha
          voltar={<VoltarALista />}
          titulo={parceiro.nome}
          subtitulo={`${parceiro.documentoMascarado ?? "sem documento"} · ${sankhya}`}
          situacao={
            <span className="flex flex-wrap items-center gap-2">
              {parceiro.tipos.map((t) => (
                <Etiqueta key={t} modulo="parceiros">
                  {NOMES_DOS_TIPOS_DE_PARCEIRO[t]}
                </Etiqueta>
              ))}
              <span className="text-muted-foreground text-sm">
                {formatarInteiro(ficha.placas.length)}{" "}
                {ficha.placas.length === 1 ? "placa vinculada" : "placas vinculadas"} agora
              </span>
            </span>
          }
        />
      }
      linhaDoTempo={
        <SeletorDeMes
          rota={`/parceiros/lista/${parceiro.id}`}
          parametros={parametros}
          meses={ficha.meses}
          atual={ficha.mes}
        />
      }
    >
      <AbasDaFichaNaUrl<AbaDoParceiro>
        abas={ABAS_DO_PARCEIRO}
        abaInicial={lerAba(parametros, IDS_DAS_ABAS_DO_PARCEIRO)}
        conteudos={conteudos}
      />
    </FichaDaRaiz>
  );
}

/** O que se vê enquanto a ficha chega. */
export function FichaDoParceiroCarregando() {
  return (
    <div
      role="status"
      aria-label="Carregando a ficha do parceiro"
      className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8"
    >
      <span className="sr-only">Carregando a ficha do parceiro</span>
      <div aria-hidden className="flex flex-col gap-5">
        <span className="bg-muted block h-5 w-28 animate-pulse rounded" />
        <span className="bg-muted block h-10 w-72 animate-pulse rounded" />
        <span className="bg-muted block h-64 max-w-2xl animate-pulse rounded-xl" />
      </div>
    </div>
  );
}
