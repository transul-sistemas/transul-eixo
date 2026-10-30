"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Etiqueta } from "@/components/etiqueta";
import { Moeda } from "@/components/formato/moeda";
import { formatarInteiro, formatarKm } from "@/components/formato/numero";
import { Placa } from "@/components/placa";
import { CelulaDaPlaca } from "./celula-da-placa";
import {
  CAMPOS_ORDENAVEIS_DE_PLACAS,
  DEFINICOES_DAS_COLUNAS_DE_PLACAS,
  type LinhaDePlaca,
  NOMES_DOS_TIPOS,
  TITULOS_DAS_COLUNAS_DE_PLACAS,
} from "@/lib/dados/placas-tipos";
import { colunasVisiveis } from "@/lib/navegacao/colunas-da-tabela";
import { lerTabela, mudarConsulta, type PadraoDaTabela } from "@/lib/navegacao/tabela";
import { useLista } from "./pendencia-da-lista";
import { type ColunaDeTabela, type Ordem, TabelaDeDados } from "./tabela-de-dados";

const SEM_VALOR = <span className="text-muted-foreground">—</span>;
const textoOuTraco = (valor: string | null) => valor ?? SEM_VALOR;

function Conjunto({ linha }: { linha: LinhaDePlaca }) {
  const { cavalo, implementos } = linha.conjunto;
  if (cavalo) return <Placa placa={cavalo} tamanho="p" />;
  if (implementos.length === 0) return SEM_VALOR;
  return (
    <span className="flex items-center gap-1">
      {implementos.slice(0, 2).map((placa) => (
        <Placa key={placa} placa={placa} tamanho="p" />
      ))}
      {implementos.length > 2 ? (
        <span className="text-muted-foreground text-xs tabular-nums">
          +{implementos.length - 2}
        </span>
      ) : null}
    </span>
  );
}

function Alertas({ linha }: { linha: LinhaDePlaca }) {
  if (linha.alertas.length === 0) return SEM_VALOR;
  const lista = linha.alertas.map((alerta) => alerta.texto).join("; ");
  return (
    <span
      title={lista}
      className="bg-muted text-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs tabular-nums"
    >
      <IconAlertTriangle aria-hidden className="text-muted-foreground size-3.5" />
      {linha.alertas.length}
      <span className="sr-only">
        {linha.alertas.length === 1 ? " alerta: " : " alertas: "}
        {lista}
      </span>
    </span>
  );
}

// Fora do componente: as colunas por id são estáveis entre renderizações. O que aparece e em que
// ordem sai das preferências (cookie) e das definições, em `colunasVisiveis`.
const CELULAS: Record<
  string,
  Pick<ColunaDeTabela<LinhaDePlaca>, "campoDeOrdem" | "celula" | "classe">
> = {
  placa: {
    campoDeOrdem: "placa",
    // O botão "Espiar" é o controle; na compacta a mini placa é a menor (a linha cabe em ~34 px).
    celula: (linha, { densidade, aoAbrir }) => (
      <CelulaDaPlaca placa={linha.placa} densidade={densidade} aoAbrir={aoAbrir} />
    ),
  },
  tipo: { campoDeOrdem: "tipo", celula: (linha) => NOMES_DOS_TIPOS[linha.tipo] },
  modelo: { campoDeOrdem: "modelo", celula: (linha) => linha.modelo },
  conjunto: { campoDeOrdem: "conjunto", celula: (linha) => <Conjunto linha={linha} /> },
  gestor: { campoDeOrdem: "gestor", celula: (linha) => linha.gestor },
  operacao: { campoDeOrdem: "operacao", celula: (linha) => textoOuTraco(linha.operacao) },
  situacao: {
    campoDeOrdem: "situacao",
    celula: (linha) => (
      <Etiqueta status={linha.grupo} titulo={linha.nomeDaSituacao}>
        <span className="font-semibold">{linha.sigla}</span>
        <span>{linha.nomeDaSituacao}</span>
      </Etiqueta>
    ),
  },
  alertas: { campoDeOrdem: "alertas", celula: (linha) => <Alertas linha={linha} /> },
  motorista: { campoDeOrdem: "motorista", celula: (linha) => textoOuTraco(linha.motorista) },
  filial: { campoDeOrdem: "filial", celula: (linha) => linha.filial },
  dias: {
    campoDeOrdem: "dias",
    classe: "text-right tabular-nums",
    celula: (linha) => formatarInteiro(linha.diasNoStatus),
  },
  km: {
    campoDeOrdem: "km",
    classe: "text-right tabular-nums",
    celula: (linha) => formatarKm(linha.km),
  },
  cr: { campoDeOrdem: "cr", celula: (linha) => textoOuTraco(linha.cr) },
  fipe: {
    campoDeOrdem: "fipe",
    classe: "text-right",
    celula: (linha) => <Moeda valor={linha.valorFipeCentavos} />,
  },
};

/** O padrão de tela larga: o CSS esconde abaixo de 1700 px enquanto a pessoa não escolheu colunas. */
const CLASSE_SO_EM_TELA_LARGA = "hidden min-[1700px]:table-cell";

/** A tabela da lista de placas: a ordem mora na URL, e a página sai do servidor já cortada. */
export function TabelaDePlacas({
  linhas,
  ordem,
  padrao,
}: {
  linhas: LinhaDePlaca[];
  ordem: Ordem;
  padrao: PadraoDaTabela;
}) {
  const rota = usePathname();
  const parametros = useSearchParams();
  const router = useRouter();
  const lista = useLista();
  const colunasEscolhidas = lista?.preferencias.colunas ?? null;
  const ordemEscolhida = lista?.preferencias.ordemDasColunas ?? null;
  const colunas = useMemo(
    () =>
      colunasVisiveis(DEFINICOES_DAS_COLUNAS_DE_PLACAS, {
        colunas: colunasEscolhidas,
        ordemDasColunas: ordemEscolhida,
      }).map<ColunaDeTabela<LinhaDePlaca>>(({ id, soEmTelaLarga }) => {
        const base = CELULAS[id] as NonNullable<(typeof CELULAS)[string]>;
        return {
          id,
          titulo: TITULOS_DAS_COLUNAS_DE_PLACAS[id] ?? id,
          ...base,
          classe: [base.classe, soEmTelaLarga ? CLASSE_SO_EM_TELA_LARGA : undefined]
            .filter(Boolean)
            .join(" "),
        };
      }),
    [colunasEscolhidas, ordemEscolhida],
  );

  const espiar = lista?.espiar;
  const aoClicarNaLinha = useMemo(
    () => (espiar ? (linha: LinhaDePlaca) => espiar(linha.placa) : undefined),
    [espiar],
  );

  function ordenarPor(campo: string) {
    const atual = lerTabela(
      new URLSearchParams(parametros.toString()),
      padrao,
      CAMPOS_ORDENAVEIS_DE_PLACAS,
    ).ordem;
    const sentido = atual.campo === campo && atual.sentido === "asc" ? "desc" : "asc";
    const novos = mudarConsulta(
      new URLSearchParams(parametros.toString()),
      { ordem: { campo, sentido } },
      padrao,
      CAMPOS_ORDENAVEIS_DE_PLACAS,
    ).toString();
    const ir = () => router.push(novos ? `${rota}?${novos}` : rota, { scroll: false });
    if (lista) lista.iniciar(ir);
    else ir();
  }

  return (
    <TabelaDeDados
      rotulo="Placas"
      colunas={colunas}
      linhas={linhas}
      idDaLinha={(linha) => linha.id}
      ordem={ordem}
      aoOrdenar={ordenarPor}
      pendente={lista?.pendente ?? false}
      densidade={lista?.preferencias.densidade ?? "compacta"}
      aoClicarNaLinha={aoClicarNaLinha}
    />
  );
}
