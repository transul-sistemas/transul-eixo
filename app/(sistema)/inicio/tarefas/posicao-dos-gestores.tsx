"use client";

import { IconCircleCheck } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Resolver } from "react-hook-form";
import { Etiqueta } from "@/components/etiqueta";
import { formatarData } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import { Button } from "@/components/ui/button";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { GestorComPosicaoPendente } from "@/lib/dados/posicao-do-dia-tipos";
import { esquemaLiberarPosicao } from "@/lib/dominio/esquemas/lider-e-aprovacao";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { errosDoResolvedor } from "../../frota/placas/assistentes/erros-do-resolvedor";
import { liberarPosicaoAcao } from "./acoes-do-lider-e-aprovacao";

// 31. Liberar a posição do dia (líder), na caixa de Tarefas: aparece só para quem é líder de operação de
// algum gestor (nucleo.gestores_com_posicao_pendente devolve vazio para os outros). O líder vê quantos
// conjuntos cada gestor respondeu e libera a porta com motivo; os sem resposta viram pendência.

interface Valores {
  motivo: string;
}

const LIBERAR: DefinicaoDeAssistente = {
  id: "liberar-posicao",
  titulo: "Liberar posição",
  versaoDoEsquema: 1,
  passos: [
    { id: "motivo", titulo: "Motivo", campos: ["motivo"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

function LiberarPosicao({
  gestor,
  dia,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  gestor: GestorComPosicaoPendente;
  dia: string;
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal: React.RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const entrada = (v: Valores) => ({ gestorId: gestor.gestor_id, dia, motivo: v.motivo ?? "" });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaLiberarPosicao.safeParse(entrada(valores));
    const problemas = r.success ? [] : r.error.issues.filter((i) => i.path[0] === "motivo");
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<Valores>(problemas) };
  };
  const faltam = Math.max(0, gestor.total - gestor.respondidos);
  return (
    <Assistente<Valores>
      definicao={LIBERAR}
      resolver={resolver}
      valoresIniciais={{ motivo: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={`${gestor.gestor_id}-${dia}`}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Liberar posição"
      mensagemConcluido="Posição liberada."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(v, chaveDeEnvio) => liberarPosicaoAcao({ chaveDeEnvio, dados: entrada(v) })}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: `Posição do dia de ${gestor.gestor}`,
          linhas: [
            { rotulo: "Dia", valor: formatarData(dia) },
            {
              rotulo: "Respondidos",
              valor: `${formatarInteiro(gestor.respondidos)} de ${formatarInteiro(gestor.total)}`,
            },
            { rotulo: "Motivo", valor: v.motivo?.trim() || undefined },
          ],
        },
      ]}
      efeitos={() => [
        "O gestor segue o dia sem responder a porta da Posição do dia.",
        faltam > 0
          ? `${formatarInteiro(faltam)} conjuntos sem resposta viram pendência de posição, uma vez.`
          : "Todos os conjuntos já têm resposta: nada vira pendência.",
      ]}
      renderPasso={(_, form) => (
        <Campo
          rotulo="Motivo da liberação"
          erro={form.formState.errors.motivo?.message}
          ajuda="Por exemplo, queda do sistema ou gestor em viagem. De 10 a 500 caracteres."
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
      )}
    />
  );
}

export function PosicaoDosGestores({
  gestores,
  dia,
}: {
  gestores: GestorComPosicaoPendente[];
  dia: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState<GestorComPosicaoPendente | null>(null);
  const quemAbriu = useRef<HTMLElement | null>(null);
  if (gestores.length === 0) return null;
  return (
    <section aria-label="Posição do dia dos seus gestores" className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">Posição do dia dos seus gestores</h2>
      <ul className="border-border bg-card divide-border divide-y rounded-xl border">
        {gestores.map((g) => {
          const completo = g.respondidos >= g.total;
          return (
            <li key={g.gestor_id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1 font-medium">{g.gestor}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatarInteiro(g.respondidos)} de {formatarInteiro(g.total)} conjuntos
              </span>
              {g.liberada ? (
                <Etiqueta status="em-atividade">
                  <IconCircleCheck aria-hidden className="size-3.5" />
                  Liberada hoje
                </Etiqueta>
              ) : completo ? (
                <Etiqueta status="em-atividade">
                  <IconCircleCheck aria-hidden className="size-3.5" />
                  Respondida
                </Etiqueta>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  aria-haspopup="dialog"
                  onClick={(e) => {
                    quemAbriu.current = e.currentTarget;
                    setAberto(g);
                  }}
                >
                  Liberar posição
                </Button>
              )}
              <BotaoDoOlho
                item={g.gestor}
                detalhes={[
                  { rotulo: "Conjuntos", valor: formatarInteiro(g.total) },
                  { rotulo: "Respondidos", valor: formatarInteiro(g.respondidos) },
                  { rotulo: "Liberada no dia", valor: g.liberada ? "Sim" : "Não" },
                ]}
              />
            </li>
          );
        })}
      </ul>
      {aberto ? (
        <LiberarPosicao
          gestor={aberto}
          dia={dia}
          focoFinal={quemAbriu}
          aoFechar={() => setAberto(null)}
          aoGravar={() => router.refresh()}
        />
      ) : null}
    </section>
  );
}
