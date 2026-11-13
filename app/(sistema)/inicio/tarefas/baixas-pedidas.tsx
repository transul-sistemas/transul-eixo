"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Resolver } from "react-hook-form";
import { Etiqueta } from "@/components/etiqueta";
import { formatarData } from "@/components/formato/data";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Placa } from "@/components/placa";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import { Button } from "@/components/ui/button";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { PedidoDeBaixa } from "@/lib/dados/baixa-tipos";
import {
  esquemaDecidirBaixa,
  NOMES_DOS_MOTIVOS_DA_BAIXA,
} from "@/lib/dominio/esquemas/dia-cr-e-baixa";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { errosDoResolvedor } from "../../frota/placas/assistentes/erros-do-resolvedor";
import { cancelarPedidoDeBaixaAcao, decidirBaixaAcao } from "../../frota/placas/acoes-de-vinculo";

// Baixa com quatro olhos (S4) na caixa de Tarefas: a Diretoria decide (aprovar ou recusar, com motivo);
// quem pediu pode cancelar enquanto está pedida. O banco recusa se quem decide for quem pediu. O
// Administrador só lê (não age em nome de ninguém).

interface ValoresDaDecisao {
  decisao: "aprovar" | "recusar" | "";
  motivo: string;
}

const DECIDIR: DefinicaoDeAssistente = {
  id: "decidir-baixa",
  titulo: "Decidir baixa",
  versaoDoEsquema: 1,
  passos: [
    { id: "decisao", titulo: "Aprovar ou recusar", campos: ["decisao", "motivo"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

const CANCELAR: DefinicaoDeAssistente = {
  id: "cancelar-pedido-de-baixa",
  titulo: "Cancelar pedido de baixa",
  versaoDoEsquema: 1,
  passos: [
    { id: "pedido", titulo: "Pedido", campos: ["confirmo"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

function DecidirBaixa({
  pedido,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  pedido: PedidoDeBaixa;
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal: React.RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const entrada = (v: ValoresDaDecisao) => ({
    pedidoId: pedido.id,
    versao: pedido.versao,
    decisao: v.decisao,
    motivo: v.motivo,
  });
  const resolver: Resolver<ValoresDaDecisao> = async (valores) => {
    const r = esquemaDecidirBaixa.safeParse(entrada(valores));
    return r.success
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<ValoresDaDecisao>(
            r.error.issues.map((i) => ({ path: i.path, message: i.message })),
          ),
        };
  };
  return (
    <Assistente<ValoresDaDecisao>
      definicao={DECIDIR}
      resolver={resolver}
      valoresIniciais={{ decisao: "", motivo: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={pedido.id}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Decidir baixa"
      mensagemConcluido="Baixa decidida."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(v, chaveDeEnvio) => decidirBaixaAcao({ chaveDeEnvio, dados: entrada(v) })}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: `Baixa de ${pedido.placa ?? ""}`,
          linhas: [
            { rotulo: "Motivo", valor: NOMES_DOS_MOTIVOS_DA_BAIXA[pedido.motivo] },
            { rotulo: "Na data", valor: formatarData(pedido.em) },
            { rotulo: "Pedida por", valor: pedido.pedido_por_nome ?? "" },
            {
              rotulo: "Decisão",
              valor:
                v.decisao === "aprovar" ? "Aprovar" : v.decisao === "recusar" ? "Recusar" : "—",
            },
          ],
        },
      ]}
      efeitos={(v) =>
        v.decisao === "recusar"
          ? ["A placa segue ativa; quem pediu recebe o motivo da recusa."]
          : [
              `A situação vai a ${pedido.sigla} em ${formatarData(pedido.em)} e os CRs da placa encerram nessa data.`,
              "A operação deixa de contar a placa; nada é apagado.",
            ]
      }
      renderPasso={(_, form) => {
        const decisao = form.watch("decisao");
        return (
          <>
            <p className="text-sm">
              Justificativa de quem pediu: <b>{pedido.justificativa}</b>
              {pedido.documento ? ` · documento ${pedido.documento}` : ""}
            </p>
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-2">Decisão</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="aprovar"
                  className="size-4"
                  {...form.register("decisao")}
                />
                Aprovar a baixa
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="recusar"
                  className="size-4"
                  {...form.register("decisao")}
                />
                Recusar a baixa
              </label>
              <p role="alert" className="text-destructive min-h-4 text-xs">
                {form.formState.errors.decisao?.message}
              </p>
            </fieldset>
            {decisao === "recusar" ? (
              <Campo rotulo="Motivo da recusa" erro={form.formState.errors.motivo?.message}>
                {(p) => <input {...p} {...form.register("motivo")} className={CLASSE_DO_CAMPO} />}
              </Campo>
            ) : null}
          </>
        );
      }}
    />
  );
}

function CancelarPedidoDeBaixa({
  pedido,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  pedido: PedidoDeBaixa;
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal: React.RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const resolver: Resolver<{ confirmo: boolean }> = async (v) =>
    v.confirmo
      ? { values: v, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<{ confirmo: boolean }>([
            {
              path: ["confirmo"],
              message: `Confirme que cancela o pedido de baixa de ${pedido.placa ?? ""}.`,
            },
          ]),
        };
  return (
    <Assistente<{ confirmo: boolean }>
      definicao={CANCELAR}
      resolver={resolver}
      valoresIniciais={{ confirmo: false }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={pedido.id}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Cancelar pedido de baixa"
      mensagemConcluido="Pedido de baixa cancelado."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(_, chaveDeEnvio) =>
        cancelarPedidoDeBaixaAcao({ chaveDeEnvio, dados: { pedidoId: pedido.id } })
      }
      aoFechar={aoFechar}
      resumo={() => [
        {
          titulo: `Baixa de ${pedido.placa ?? ""}`,
          linhas: [{ rotulo: "Motivo", valor: NOMES_DOS_MOTIVOS_DA_BAIXA[pedido.motivo] }],
        },
      ]}
      efeitos={() => [
        "O pedido sai da fila da Diretoria e a placa segue ativa, sem a marca de baixa pedida.",
      ]}
      renderPasso={(_, form) => (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" {...form.register("confirmo")} />
          Cancelo o pedido de baixa de {pedido.placa}
          <span role="alert" className="text-destructive text-xs">
            {form.formState.errors.confirmo?.message}
          </span>
        </label>
      )}
    />
  );
}

export function BaixasPedidas({
  pedidos,
  podeDecidir,
  podeCancelar,
}: {
  pedidos: PedidoDeBaixa[];
  podeDecidir: boolean;
  podeCancelar: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState<{
    tipo: "decidir" | "cancelar";
    pedido: PedidoDeBaixa;
  } | null>(null);
  const quemAbriu = useRef<HTMLElement | null>(null);
  const comum = {
    focoFinal: quemAbriu,
    aoFechar: () => setAberto(null),
    aoGravar: () => router.refresh(),
  };
  return (
    <section aria-label="Baixas pedidas" className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">Baixas pedidas</h2>
      {pedidos.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma baixa espera decisão.</p>
      ) : (
        <ul className="border-border bg-card divide-border divide-y rounded-xl border">
          {pedidos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              {p.placa ? <Placa placa={p.placa} tamanho="p" /> : null}
              <span className="flex-1">
                {NOMES_DOS_MOTIVOS_DA_BAIXA[p.motivo]} em {formatarData(p.em)} · pedida por{" "}
                {p.pedido_por_nome ?? "—"}
              </span>
              {p.atrasado ? (
                <Etiqueta status="impedida">Prazo venceu em {formatarData(p.prazo_ate)}</Etiqueta>
              ) : (
                <Etiqueta status="atencao">Decidir até {formatarData(p.prazo_ate)}</Etiqueta>
              )}
              {podeDecidir ? (
                <Button
                  size="sm"
                  aria-haspopup="dialog"
                  onClick={(e) => {
                    quemAbriu.current = e.currentTarget;
                    setAberto({ tipo: "decidir", pedido: p });
                  }}
                >
                  Decidir baixa
                </Button>
              ) : null}
              {podeCancelar ? (
                <Button
                  size="sm"
                  variant="outline"
                  aria-haspopup="dialog"
                  onClick={(e) => {
                    quemAbriu.current = e.currentTarget;
                    setAberto({ tipo: "cancelar", pedido: p });
                  }}
                >
                  Cancelar pedido de baixa
                </Button>
              ) : null}
              <BotaoDoOlho
                item={p.placa ?? "pedido de baixa"}
                {...(p.placa ? { hrefDaFicha: `/frota/placas/${p.placa}` } : {})}
                detalhes={[
                  { rotulo: "Motivo", valor: NOMES_DOS_MOTIVOS_DA_BAIXA[p.motivo] },
                  { rotulo: "Sigla ao aprovar", valor: p.sigla },
                  { rotulo: "Justificativa", valor: p.justificativa },
                  { rotulo: "Documento", valor: p.documento ?? "Sem anexo" },
                  { rotulo: "Pedida em", valor: formatarData(p.pedido_em) },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
      {aberto?.tipo === "decidir" ? <DecidirBaixa pedido={aberto.pedido} {...comum} /> : null}
      {aberto?.tipo === "cancelar" ? (
        <CancelarPedidoDeBaixa pedido={aberto.pedido} {...comum} />
      ) : null}
    </section>
  );
}
