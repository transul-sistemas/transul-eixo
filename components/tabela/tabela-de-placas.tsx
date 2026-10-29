"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Etiqueta } from "@/components/etiqueta";
import { Placa } from "@/components/placa";
import {
  CAMPOS_ORDENAVEIS_DE_PLACAS,
  type LinhaDePlaca,
  NOMES_DOS_TIPOS,
} from "@/lib/dados/placas-tipos";
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

// Fora do componente: a lista de colunas precisa ser estável entre renderizações.
const COLUNAS: readonly ColunaDeTabela<LinhaDePlaca>[] = [
  {
    id: "placa",
    titulo: "Placa",
    campoDeOrdem: "placa",
    celula: (linha) => <Placa placa={linha.placa} tamanho="m" />,
  },
  {
    id: "tipo",
    titulo: "Tipo",
    campoDeOrdem: "tipo",
    celula: (linha) => NOMES_DOS_TIPOS[linha.tipo],
  },
  { id: "modelo", titulo: "Modelo", campoDeOrdem: "modelo", celula: (linha) => linha.modelo },
  {
    id: "conjunto",
    titulo: "Conjunto",
    campoDeOrdem: "conjunto",
    // Só em tela larga (1700 px ou mais): no 1366 o espaço é de Situação e Alertas. Continua no
    // seletor de colunas (Tarefa 9) para quem quiser vê-la em qualquer tela.
    classe: "hidden min-[1700px]:table-cell",
    celula: (linha) => <Conjunto linha={linha} />,
  },
  { id: "gestor", titulo: "Gestor", campoDeOrdem: "gestor", celula: (linha) => linha.gestor },
  {
    id: "operacao",
    titulo: "Operação",
    campoDeOrdem: "operacao",
    celula: (linha) => textoOuTraco(linha.operacao),
  },
  {
    id: "situacao",
    titulo: "Situação",
    campoDeOrdem: "situacao",
    celula: (linha) => (
      <Etiqueta status={linha.grupo} titulo={linha.nomeDaSituacao}>
        <span className="font-semibold">{linha.sigla}</span>
        <span>{linha.nomeDaSituacao}</span>
      </Etiqueta>
    ),
  },
  {
    id: "alertas",
    titulo: "Alertas",
    campoDeOrdem: "alertas",
    celula: (linha) => <Alertas linha={linha} />,
  },
];

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
      colunas={COLUNAS}
      linhas={linhas}
      idDaLinha={(linha) => linha.id}
      ordem={ordem}
      aoOrdenar={ordenarPor}
      pendente={lista?.pendente ?? false}
      densidade={lista?.preferencias.densidade ?? "compacta"}
    />
  );
}
