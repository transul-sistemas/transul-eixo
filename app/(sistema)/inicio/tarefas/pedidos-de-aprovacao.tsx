"use client";

import { IconCircleCheck, IconCircleX, IconSend } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import type { FieldValues, Resolver, ResolverResult } from "react-hook-form";
import { Etiqueta } from "@/components/etiqueta";
import { formatarData } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import { Button } from "@/components/ui/button";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { PedidoDeAprovacao } from "@/lib/dados/processos-tipos";
import {
  esquemaDecidirAprovacao,
  esquemaPedirAprovacao,
  NOMES_DOS_TIPOS_DE_PEDIDO,
  TIPOS_DE_PEDIDO,
} from "@/lib/dominio/esquemas/lider-e-aprovacao";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { errosDoResolvedor } from "../../frota/placas/assistentes/erros-do-resolvedor";
import { decidirAprovacaoAcao, pedirAprovacaoAcao } from "./acoes-do-lider-e-aprovacao";

// 37. Pedir aprovação ou permissão (mês fechado, permissão ou outro), na caixa de Tarefas: qualquer pessoa
// com login pede (também pelo Ctrl+K, ?assistente=pedir-aprovacao); só a Diretoria decide, e quem pede não
// decide (o banco confere). Cada pessoa vê os próprios pedidos; a Diretoria e o Administrador, todos.

export const ID_DO_PEDIR = "pedir-aprovacao";

interface ValoresDoPedido {
  tipo: (typeof TIPOS_DE_PEDIDO)[number] | "";
  descricao: string;
  referencia: string;
}

interface ValoresDaDecisao {
  decisao: "aprovado" | "recusado" | "";
  motivo: string;
}

const PEDIR: DefinicaoDeAssistente = {
  id: "pedir-aprovacao",
  titulo: "Pedir aprovação",
  versaoDoEsquema: 1,
  passos: [
    { id: "pedido", titulo: "Pedido", campos: ["tipo", "descricao", "referencia"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

const DECIDIR: DefinicaoDeAssistente = {
  id: "decidir-aprovacao",
  titulo: "Decidir pedido",
  versaoDoEsquema: 1,
  passos: [
    { id: "decisao", titulo: "Aprovar ou recusar", campos: ["decisao", "motivo"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

function errosDe<V extends FieldValues>(
  r:
    | { success: true }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } },
  valores: V,
): ResolverResult<V> {
  return r.success
    ? { values: valores, errors: {} }
    : {
        values: {},
        errors: errosDoResolvedor<V>(
          r.error.issues.map((i) => ({ path: i.path, message: i.message })),
        ),
      };
}

function PedirAprovacao({
  aoFechar,
  focoFinal,
}: {
  aoFechar: () => void;
  focoFinal: React.RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const router = useRouter();
  const resolver: Resolver<ValoresDoPedido> = async (valores) =>
    errosDe(esquemaPedirAprovacao.safeParse(valores), valores);
  return (
    <Assistente<ValoresDoPedido>
      definicao={PEDIR}
      resolver={resolver}
      valoresIniciais={{ tipo: "", descricao: "", referencia: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Pedir aprovação"
      mensagemConcluido="Pedido enviado à Diretoria."
      fecharAoGravar
      aoGravar={() => router.refresh()}
      aoConcluir={(v, chaveDeEnvio) => pedirAprovacaoAcao({ chaveDeEnvio, dados: v })}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Pedido de aprovação",
          linhas: [
            { rotulo: "O que pede", valor: v.tipo ? NOMES_DOS_TIPOS_DE_PEDIDO[v.tipo] : undefined },
            { rotulo: "Explicação", valor: v.descricao?.trim() || undefined },
            { rotulo: "Referência", valor: v.referencia?.trim() || undefined },
          ],
        },
      ]}
      efeitos={() => [
        "O pedido entra na fila da Diretoria, com prazo de 48 horas.",
        "Outra pessoa da Diretoria decide: quem pede não decide o próprio pedido.",
      ]}
      renderPasso={(_, form) => (
        <>
          <Campo rotulo="O que você pede" erro={form.formState.errors.tipo?.message}>
            {(p) => (
              <select {...p} {...form.register("tipo")} className={CLASSE_DO_CAMPO}>
                <option value="">Escolha</option>
                {TIPOS_DE_PEDIDO.map((t) => (
                  <option key={t} value={t}>
                    {NOMES_DOS_TIPOS_DE_PEDIDO[t]}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo
            rotulo="Explique o pedido"
            erro={form.formState.errors.descricao?.message}
            ajuda="O que precisa ser aprovado e por quê. De 10 a 500 caracteres."
          >
            {(p) => (
              <textarea
                {...p}
                {...form.register("descricao")}
                rows={3}
                maxLength={500}
                className={`${CLASSE_DO_CAMPO} h-auto py-2`}
              />
            )}
          </Campo>
          <Campo
            rotulo="Referência (opcional)"
            erro={form.formState.errors.referencia?.message}
            ajuda="O mês, a placa ou o registro a que o pedido se refere."
          >
            {(p) => (
              <input
                {...p}
                {...form.register("referencia")}
                maxLength={120}
                className={CLASSE_DO_CAMPO}
              />
            )}
          </Campo>
        </>
      )}
    />
  );
}

function DecidirPedido({
  pedido,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  pedido: PedidoDeAprovacao;
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal: React.RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const entrada = (v: ValoresDaDecisao) => ({
    pedidoId: pedido.id,
    versao: pedido.versao,
    decisao: v.decisao,
    motivo: v.motivo ?? "",
  });
  const resolver: Resolver<ValoresDaDecisao> = async (valores) =>
    errosDe(esquemaDecidirAprovacao.safeParse(entrada(valores)), valores);
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
      rotuloConcluir="Decidir pedido"
      mensagemConcluido="Pedido decidido."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(v, chaveDeEnvio) => decidirAprovacaoAcao({ chaveDeEnvio, dados: entrada(v) })}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: `Pedido ${formatarInteiro(pedido.numero)}`,
          linhas: [
            { rotulo: "O que pede", valor: NOMES_DOS_TIPOS_DE_PEDIDO[pedido.tipo] },
            { rotulo: "Pedido por", valor: pedido.pedido_por },
            { rotulo: "Em", valor: formatarData(pedido.pedido_em) },
            {
              rotulo: "Decisão",
              valor:
                v.decisao === "aprovado"
                  ? "Aprovar"
                  : v.decisao === "recusado"
                    ? "Recusar"
                    : undefined,
            },
          ],
        },
      ]}
      efeitos={(v) =>
        v.decisao === "recusado"
          ? ["Quem pediu recebe o motivo da recusa."]
          : ["Quem pediu vê o pedido aprovado e segue com a ação."]
      }
      renderPasso={(_, form) => (
        <>
          <p className="text-sm">
            {pedido.descricao}
            {pedido.referencia ? ` · ${pedido.referencia}` : ""}
          </p>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-2">Decisão</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="aprovado"
                className="size-4"
                {...form.register("decisao")}
              />
              Aprovar o pedido
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="recusado"
                className="size-4"
                {...form.register("decisao")}
              />
              Recusar o pedido
            </label>
            <span role="alert" className="text-destructive text-xs">
              {form.formState.errors.decisao?.message}
            </span>
          </fieldset>
          <Campo
            rotulo="Motivo"
            erro={form.formState.errors.motivo?.message}
            ajuda="Obrigatório para recusar; de 10 a 500 caracteres."
          >
            {(p) => (
              <textarea
                {...p}
                {...form.register("motivo")}
                rows={3}
                maxLength={500}
                className={`${CLASSE_DO_CAMPO} h-auto py-2`}
              />
            )}
          </Campo>
        </>
      )}
    />
  );
}

export function PedidosDeAprovacao({
  pedidos,
  podeDecidir,
}: {
  pedidos: PedidoDeAprovacao[];
  podeDecidir: boolean;
}) {
  const router = useRouter();
  const rota = usePathname();
  const parametros = useSearchParams();
  const [decidindo, setDecidindo] = useState<PedidoDeAprovacao | null>(null);
  const quemAbriu = useRef<HTMLElement | null>(null);
  const pedindo = parametros.get("assistente") === ID_DO_PEDIR;
  const comPedir = (abrir: boolean) => {
    const novos = new URLSearchParams(parametros.toString());
    if (abrir) novos.set("assistente", ID_DO_PEDIR);
    else novos.delete("assistente");
    const busca = novos.toString();
    return busca ? `${rota}?${busca}` : rota;
  };
  const abertos = pedidos.filter((p) => p.situacao === "pedido");
  return (
    <section aria-label="Pedidos de aprovação" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Pedidos de aprovação</h2>
        <Button
          size="sm"
          variant="outline"
          aria-haspopup="dialog"
          onClick={(e) => {
            quemAbriu.current = e.currentTarget;
            router.push(comPedir(true), { scroll: false });
          }}
        >
          <IconSend aria-hidden className="size-4" />
          Pedir aprovação
        </Button>
      </div>
      {abertos.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum pedido espera decisão.</p>
      ) : (
        <ul className="border-border bg-card divide-border divide-y rounded-xl border">
          {abertos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1">
                <b>{NOMES_DOS_TIPOS_DE_PEDIDO[p.tipo]}</b> · {p.descricao}
                <span className="text-muted-foreground block text-xs">
                  Pedido {formatarInteiro(p.numero)} por {p.pedido_por} em{" "}
                  {formatarData(p.pedido_em)}
                </span>
              </span>
              <Etiqueta status="atencao">Espera a Diretoria</Etiqueta>
              {podeDecidir ? (
                <Button
                  size="sm"
                  aria-haspopup="dialog"
                  onClick={(e) => {
                    quemAbriu.current = e.currentTarget;
                    setDecidindo(p);
                  }}
                >
                  Decidir pedido
                </Button>
              ) : null}
              <BotaoDoOlho
                item={`Pedido ${formatarInteiro(p.numero)}`}
                detalhes={[
                  { rotulo: "O que pede", valor: NOMES_DOS_TIPOS_DE_PEDIDO[p.tipo] },
                  { rotulo: "Explicação", valor: p.descricao },
                  { rotulo: "Referência", valor: p.referencia ?? "Sem referência" },
                  { rotulo: "Pedido por", valor: p.pedido_por },
                  { rotulo: "Pedido em", valor: formatarData(p.pedido_em) },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
      {pedidos.some((p) => p.situacao !== "pedido") ? (
        <ul aria-label="Pedidos decididos" className="flex flex-col gap-1 text-sm">
          {pedidos
            .filter((p) => p.situacao !== "pedido")
            .slice(0, 5)
            .map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                {p.situacao === "aprovado" ? (
                  <Etiqueta status="em-atividade">
                    <IconCircleCheck aria-hidden className="size-3.5" />
                    Aprovado
                  </Etiqueta>
                ) : (
                  <Etiqueta status="impedida">
                    <IconCircleX aria-hidden className="size-3.5" />
                    Recusado
                  </Etiqueta>
                )}
                <span>
                  {NOMES_DOS_TIPOS_DE_PEDIDO[p.tipo]} · {p.descricao}
                  {p.motivo_da_decisao ? ` · ${p.motivo_da_decisao}` : ""}
                </span>
              </li>
            ))}
        </ul>
      ) : null}
      {pedindo ? (
        <PedirAprovacao
          focoFinal={quemAbriu}
          aoFechar={() => router.replace(comPedir(false), { scroll: false })}
        />
      ) : null}
      {decidindo ? (
        <DecidirPedido
          pedido={decidindo}
          focoFinal={quemAbriu}
          aoFechar={() => setDecidindo(null)}
          aoGravar={() => router.refresh()}
        />
      ) : null}
    </section>
  );
}
