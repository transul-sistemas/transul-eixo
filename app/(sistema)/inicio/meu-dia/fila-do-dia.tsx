"use client";

import { IconChevronRight, IconCircleCheck } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { formatarInteiro } from "@/components/formato/numero";
import { ListaVazia } from "@/components/tabela/estados";
import { Button } from "@/components/ui/button";
import type { PosicoesDoDia } from "@/lib/dados/posicao-do-dia-tipos";
import type { LinhaDoPedido } from "@/lib/dominio/meu-dia";
import { contadorDaPorta } from "@/lib/dominio/posicao-do-dia";
import type { Tarefa } from "@/lib/dominio/tarefas";
import { PedidosEmLeitura } from "./pedidos-em-leitura";
import { PortaDaPosicao } from "./porta-da-posicao";
import { ReceberPlacasEmLote } from "./receber-placas-em-lote";

// A fila guiada do dia: só aparece o que há a fazer. O primeiro passo (Receber placas) abre sozinho, em
// popup central, ao entrar; fechar o popup devolve a fila, com o que ficou. Cada tarefa abre a tela ou
// o assistente que a resolve.

const semAssinatura = () => () => {};

interface Props {
  linhas: LinhaDoPedido[];
  /** O login não tem pessoa ligada: não há carteira, então não há o que receber. */
  semCarteira: boolean;
  outras: Tarefa[];
  /** As outras tarefas não puderam ser lidas (o aviso diz isso; nunca finge que não há nada). */
  outrasIndisponiveis: boolean;
  /** Hoje em São Paulo (`aaaa-mm-dd`), para o "há N dias" de cada pedido. */
  hoje: string;
  /** O Administrador vê a fila e os dados, sem os botões de decidir: só o gestor de destino decide. */
  somenteLeitura?: boolean;
  /** A Posição do dia (M2) quando a porta abre hoje; nula quando já foi respondida ou liberada. */
  posicao?: PosicoesDoDia | null;
  /** A Posição do dia não pôde ser lida (o aviso diz isso e oferece tentar de novo). */
  posicaoIndisponivel?: boolean;
}

export function FilaDoDia({
  linhas,
  semCarteira,
  outras,
  outrasIndisponiveis,
  hoje,
  somenteLeitura = false,
  posicao = null,
  posicaoIndisponivel = false,
}: Props) {
  const router = useRouter();
  // O popup abre sozinho depois da hidratação (o assistente só monta no navegador).
  const montado = useSyncExternalStore(
    semAssinatura,
    () => true,
    () => false,
  );
  const [fechado, setFechado] = useState(false);
  const [posicaoConcluida, setPosicaoConcluida] = useState(false);
  const aberto = montado && !fechado && linhas.length > 0 && !somenteLeitura;
  const decidindo = linhas.length > 0 && !somenteLeitura;
  const comPosicao = posicao !== null && posicao.conjuntos.length > 0 && !posicaoConcluida;
  // Fila guiada: a porta da Posição do dia abre depois de Receber placas (ou logo, se não há o que receber).
  const portaAberta = montado && comPosicao && !aberto;
  const total = (decidindo ? 1 : 0) + (comPosicao ? 1 : 0) + outras.length;
  const antesDasOutras = (decidindo ? 1 : 0) + (comPosicao ? 1 : 0);

  function aoFechar() {
    setFechado(true);
    // A lista atualiza: o que foi decidido sai da fila (sem registro fantasma).
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {somenteLeitura ? <PedidosEmLeitura linhas={linhas} hoje={hoje} /> : null}
      {semCarteira && !somenteLeitura ? (
        <p
          role="status"
          className="text-muted-foreground border-border rounded-lg border p-3 text-sm"
        >
          Este login não está ligado a uma pessoa do Eixo, então não tem carteira nem placas para
          receber. Entre com o login de um gestor de frota para ver os pedidos dele.
        </p>
      ) : null}
      {posicaoIndisponivel ? (
        <p role="alert" className="border-border rounded-lg border p-3 text-sm">
          Não foi possível ler a Posição do dia agora.{" "}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="underline underline-offset-4"
          >
            Tentar de novo
          </button>
        </p>
      ) : null}
      {outrasIndisponiveis ? (
        <p role="alert" className="border-border rounded-lg border p-3 text-sm">
          Não foi possível ler as outras tarefas agora. Recarregue a página para tentar de novo.
        </p>
      ) : null}

      {total === 0 && !outrasIndisponiveis && !(somenteLeitura && linhas.length > 0) ? (
        <ListaVazia
          titulo="Nada espera você agora"
          descricao={
            somenteLeitura
              ? "Nenhum pedido de transferência está aberto. Siga para o Acompanhamento da frota."
              : "Nenhuma placa espera a sua decisão. Siga para o Acompanhamento da frota."
          }
        />
      ) : (
        <ol aria-label="Tarefas do seu dia" className="flex flex-col gap-3">
          {decidindo ? (
            <li className="border-border bg-card flex flex-wrap items-center gap-4 rounded-xl border px-4 py-3">
              <span
                aria-hidden
                className="bg-primary text-primary-foreground inline-flex min-w-10 justify-center rounded-full px-2 py-1 text-sm font-semibold tabular-nums"
              >
                {formatarInteiro(linhas.length)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-muted-foreground text-xs">
                  Tarefa 1 de {formatarInteiro(total)} do seu dia
                </span>
                <span className="text-base font-medium">Receber placas</span>
                <span className="text-muted-foreground text-sm">
                  {linhas.length === 1
                    ? "1 pedido esperando você"
                    : `${formatarInteiro(linhas.length)} pedidos esperando você`}
                </span>
              </div>
              <Button onClick={() => setFechado(false)} data-testid="abrir-receber-placas">
                Receber placas
              </Button>
            </li>
          ) : somenteLeitura ? null : (
            <li className="text-muted-foreground flex items-center gap-2 text-sm">
              <IconCircleCheck aria-hidden className="size-4" />
              Nenhuma placa espera a sua decisão.
            </li>
          )}
          {comPosicao && posicao ? (
            <li className="border-border bg-card flex flex-wrap items-center gap-4 rounded-xl border px-4 py-3">
              <span
                aria-hidden
                className="bg-primary text-primary-foreground inline-flex min-w-10 justify-center rounded-full px-2 py-1 text-sm font-semibold tabular-nums"
              >
                {formatarInteiro(posicao.conjuntos.length)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-muted-foreground text-xs">
                  Tarefa {formatarInteiro(decidindo ? 2 : 1)} de {formatarInteiro(total)} do seu dia
                </span>
                <span className="text-base font-medium">Posição do dia</span>
                <span className="text-muted-foreground text-sm">
                  {formatarInteiro(contadorDaPorta(posicao.conjuntos).respondidos)} de{" "}
                  {formatarInteiro(posicao.conjuntos.length)} conjuntos preenchidos
                </span>
              </div>
            </li>
          ) : null}
          {outras.map((t, i) => (
            <li key={t.id}>
              <Link
                href={t.href}
                className="border-border bg-card hover:bg-muted focus-visible:ring-ring/50 flex items-center gap-4 rounded-xl border px-4 py-3 outline-none focus-visible:ring-3"
              >
                <span
                  aria-hidden
                  className="bg-muted text-foreground inline-flex min-w-10 justify-center rounded-full px-2 py-1 text-sm font-semibold tabular-nums"
                >
                  {formatarInteiro(t.quantidade)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-muted-foreground text-xs">
                    Tarefa {formatarInteiro(antesDasOutras + 1 + i)} de {formatarInteiro(total)} do
                    seu dia
                  </span>
                  <span className="text-sm font-medium">{t.texto}</span>
                </span>
                <IconChevronRight aria-hidden className="text-muted-foreground size-4" />
              </Link>
            </li>
          ))}
        </ol>
      )}

      {aberto ? <ReceberPlacasEmLote linhas={linhas} hoje={hoje} aoFechar={aoFechar} /> : null}
      {portaAberta && posicao ? (
        <PortaDaPosicao
          posicoes={posicao}
          aoConcluir={() => {
            setPosicaoConcluida(true);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
