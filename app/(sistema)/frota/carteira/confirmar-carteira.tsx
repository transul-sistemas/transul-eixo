"use client";

import type { RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { formatarMes } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import type { PlacaDaCarteira } from "@/lib/dados/acompanhamento-tipos";
import { esquemaConfirmarCarteira } from "@/lib/dominio/esquemas/acompanhamento";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { errosDoResolvedor } from "../placas/assistentes/erros-do-resolvedor";
import { confirmarCarteiraAcao } from "./acoes";

// Confirmar carteira: o gestor diz, para cada placa escolhida (uma, ou as pendentes da página), se
// ela confere no mês; "não confere" pede a observação. Conferir e gravar (tudo ou nada no banco).

interface Item {
  ativoId: string;
  placa: string;
  confere: boolean;
  observacao: string;
}
interface Valores {
  itens: Item[];
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "confirmar-carteira",
  titulo: "Confirmar carteira",
  versaoDoEsquema: 1,
  passos: [
    { id: "placas", titulo: "Placas", campos: ["itens"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function ConfirmarCarteira({
  mes,
  placas,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  mes: string;
  placas: PlacaDaCarteira[];
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaConfirmarCarteira.safeParse({ mes, itens: valores.itens });
    return r.success
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<Valores>(
            r.error.issues.map((i) => ({ path: i.path, message: i.message })),
          ),
        };
  };
  const contar = (v: Valores) => ({
    conferem: v.itens.filter((i) => i.confere).length,
    nao: v.itens.filter((i) => !i.confere).length,
  });
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{
        itens: placas.map((p) => ({
          ativoId: p.ativoId,
          placa: p.placa,
          confere: p.confere ?? true,
          observacao: p.observacao ?? "",
        })),
      }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={`${mes}-${placas.map((p) => p.placa).join("-")}`}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Confirmar carteira"
      mensagemConcluido="Carteira confirmada."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(valores, chaveDeEnvio) =>
        confirmarCarteiraAcao({ chaveDeEnvio, dados: { mes, itens: valores.itens } })
      }
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: `Carteira de ${formatarMes(mes)}`,
          linhas: [
            { rotulo: "Placas", valor: formatarInteiro(v.itens.length) },
            { rotulo: "Conferem", valor: formatarInteiro(contar(v).conferem) },
            { rotulo: "Não conferem", valor: formatarInteiro(contar(v).nao) },
          ],
        },
      ]}
      efeitos={(v) => [
        <>
          {formatarInteiro(v.itens.length)} placas ficam confirmadas em <b>{formatarMes(mes)}</b>.
        </>,
        "Quem já tinha resposta neste mês tem a resposta trocada pela nova.",
      ]}
      renderPasso={(_, form) => (
        <ul className="flex flex-col gap-3" aria-label="Placas a confirmar">
          {placas.map((p, i) => {
            const confere = form.watch(`itens.${i}.confere`);
            const erro = form.formState.errors.itens?.[i]?.observacao?.message;
            return (
              <li
                key={p.ativoId}
                className="border-border flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{p.placa}</span>
                  <span className="text-muted-foreground text-sm">{p.modelo}</span>
                </div>
                <div
                  role="radiogroup"
                  aria-label={`Resposta para ${p.placa}`}
                  className="flex gap-4 text-sm"
                >
                  <label className="flex min-h-9 items-center gap-2">
                    <input
                      type="radio"
                      className="size-4"
                      checked={confere}
                      onChange={() =>
                        form.setValue(`itens.${i}.confere`, true, { shouldValidate: false })
                      }
                    />
                    Confere
                  </label>
                  <label className="flex min-h-9 items-center gap-2">
                    <input
                      type="radio"
                      className="size-4"
                      checked={!confere}
                      onChange={() =>
                        form.setValue(`itens.${i}.confere`, false, { shouldValidate: false })
                      }
                    />
                    Não confere
                  </label>
                </div>
                {!confere ? (
                  <label className="flex flex-col gap-1 text-sm">
                    <span>O que não confere em {p.placa}</span>
                    <textarea
                      rows={2}
                      className="border-input bg-card rounded-lg border px-3 py-2"
                      aria-invalid={erro ? true : undefined}
                      {...form.register(`itens.${i}.observacao`)}
                    />
                    <span role="alert" className="text-destructive min-h-4 text-xs">
                      {erro}
                    </span>
                  </label>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    />
  );
}
