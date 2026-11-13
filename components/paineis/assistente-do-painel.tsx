"use client";

import { IconPlus } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useRef, useSyncExternalStore } from "react";
import { Controller, type FieldValues, type Resolver } from "react-hook-form";
import { gravarAssistenteDoPainelAcao } from "@/app/(sistema)/acoes-dos-paineis";
import { errosDoResolvedor } from "@/app/(sistema)/frota/placas/assistentes/erros-do-resolvedor";
import { formatarData } from "@/components/formato/data";
import { CampoMoeda } from "@/components/formato/moeda";
import { formatarMoeda } from "@/components/formato/moeda-valor";
import { formatarInteiro, formatarKm, formatarLitros } from "@/components/formato/numero";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Button } from "@/components/ui/button";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import { useAssistenteNaUrl } from "@/components/wizard/use-assistente-na-url";
import type { OpcaoDoPainel } from "@/lib/dados/painel-tipos";
import {
  ASSISTENTES_DOS_PAINEIS,
  type CampoDoAssistente,
  ESQUEMAS_DOS_PAINEIS,
  type IdDoAssistenteDoPainel,
  valoresIniciaisDoAssistente,
} from "@/lib/dominio/esquemas/paineis";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";

// O assistente de uma tela de painel (Fechar mês, Pedir ajuste, Indicar substituto...), sempre em popup
// central com stepper, resumo ao vivo e rascunho. Abre pelo botão (verbo + objeto) ou pela URL
// `?assistente=<id>` (o Ctrl+K leva até aqui). Os campos e o esquema vêm de lib/dominio/esquemas/paineis.ts,
// os mesmos que o servidor confere.

type Valores = Record<string, string | number> & FieldValues;

const semAssinatura = () => () => {};

function opcoesDoCampo(
  campo: CampoDoAssistente,
  opcoes: Record<string, OpcaoDoPainel[]>,
): readonly OpcaoDoPainel[] {
  if (campo.opcoes === undefined) return [];
  return typeof campo.opcoes === "string" ? (opcoes[campo.opcoes] ?? []) : campo.opcoes;
}

function textoDoValor(
  campo: CampoDoAssistente,
  valor: string | number | undefined,
  opcoes: Record<string, OpcaoDoPainel[]>,
): string {
  if (valor === undefined || valor === "") return "";
  switch (campo.tipo) {
    case "selecao":
      return opcoesDoCampo(campo, opcoes).find((o) => o.id === valor)?.nome ?? "";
    case "moeda":
      return Number(valor) > 0 ? formatarMoeda(Number(valor)) : "";
    case "data":
      return formatarData(String(valor));
    case "numero":
      if (!Number(valor)) return "";
      return campo.id === "litros"
        ? formatarLitros(Number(valor))
        : campo.id === "hodometro"
          ? formatarKm(Number(valor))
          : formatarInteiro(Number(valor));
    default:
      return String(valor).trim();
  }
}

export function BotaoDoAssistenteDoPainel({
  id,
  opcoes,
  hoje,
}: {
  id: IdDoAssistenteDoPainel;
  opcoes: Record<string, OpcaoDoPainel[]>;
  hoje: string;
}) {
  const info = ASSISTENTES_DOS_PAINEIS[id];
  const usuario = useUsuarioDaSessao();
  const router = useRouter();
  const { aberto, abrir, fechar } = useAssistenteNaUrl(id);
  const botao = useRef<HTMLButtonElement>(null);
  // O assistente monta só no navegador (o rascunho fica no localStorage).
  const noNavegador = useSyncExternalStore(
    semAssinatura,
    () => true,
    () => false,
  );
  const esquema = ESQUEMAS_DOS_PAINEIS[id];
  const definicao: DefinicaoDeAssistente = {
    id: `painel-${id}`,
    titulo: info.titulo,
    versaoDoEsquema: 1,
    passos: [
      ...info.passos.map((p) => ({
        id: p.id,
        titulo: p.titulo,
        campos: p.campos.map((c) => c.id),
      })),
      { id: "conferir", titulo: "Conferir", campos: [] },
    ],
  };
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquema.safeParse(valores);
    return r.success
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<Valores>(
            r.error.issues.map((i) => ({ path: i.path, message: i.message })),
          ),
        };
  };

  return (
    <>
      <Button ref={botao} onClick={abrir} data-testid={`abrir-${id}`}>
        <IconPlus data-icon="inline-start" />
        {info.titulo}
        {info.provisorio ? <span className="text-xs opacity-80">(provisório)</span> : null}
      </Button>
      {aberto && noNavegador ? (
        <Assistente<Valores>
          definicao={definicao}
          resolver={resolver}
          valoresIniciais={valoresIniciaisDoAssistente(id, hoje) as Valores}
          validarRascunho={(v) =>
            typeof v === "object" && v !== null ? (v as Partial<Valores>) : null
          }
          usuario={usuario}
          focoFinal={botao}
          rotuloConcluir={info.titulo}
          mensagemConcluido={info.concluido}
          aoConcluir={(valores, chaveDeEnvio) =>
            gravarAssistenteDoPainelAcao(id, { chaveDeEnvio, dados: valores })
          }
          aoGravar={() => router.refresh()}
          aoFechar={fechar}
          resumo={(v) =>
            info.passos.map((p) => ({
              titulo: p.titulo,
              linhas: p.campos.map((c) => ({
                rotulo: c.rotulo,
                valor: textoDoValor(c, v[c.id], opcoes),
              })),
            }))
          }
          efeitos={() => info.efeitos}
          renderPasso={(passo, form) => {
            const definido = info.passos.find((p) => p.id === passo.id);
            if (!definido) return null;
            const erros = form.formState.errors;
            const erroDe = (c: string) => {
              const e = erros[c];
              return e && typeof e.message === "string" ? e.message : undefined;
            };
            return (
              <div className="flex flex-col gap-4">
                {info.provisorio && passo.id === info.passos[0]?.id ? (
                  <p
                    role="note"
                    className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm"
                  >
                    Provisório: o Sankhya continua a fonte do abastecimento. Use só quando o
                    lançamento ainda não chegou de lá.
                  </p>
                ) : null}
                {definido.campos.map((c) => {
                  if (c.tipo === "moeda") {
                    return (
                      <Controller
                        key={c.id}
                        control={form.control}
                        name={c.id}
                        render={({ field }) => (
                          <div className="flex flex-col gap-1">
                            <CampoMoeda
                              rotulo={c.rotulo}
                              valor={Number(field.value) || 0}
                              onChange={field.onChange}
                            />
                            <p role="alert" className="text-destructive min-h-4 text-xs">
                              {erroDe(c.id)}
                            </p>
                          </div>
                        )}
                      />
                    );
                  }
                  const lista = opcoesDoCampo(c, opcoes);
                  return (
                    <Campo key={c.id} rotulo={c.rotulo} erro={erroDe(c.id)} ajuda={c.ajuda}>
                      {(acessivel) =>
                        c.tipo === "selecao" ? (
                          <select
                            className={CLASSE_DO_CAMPO}
                            {...acessivel}
                            {...form.register(c.id)}
                          >
                            <option value="">
                              {lista.length === 0
                                ? "Nenhuma opção disponível"
                                : "Escolha uma opção"}
                            </option>
                            {lista.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.nome}
                              </option>
                            ))}
                          </select>
                        ) : c.tipo === "area" ? (
                          <textarea
                            rows={4}
                            maxLength={500}
                            className={`${CLASSE_DO_CAMPO} h-auto py-2`}
                            {...acessivel}
                            {...form.register(c.id)}
                          />
                        ) : c.tipo === "numero" ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min={0}
                            className={CLASSE_DO_CAMPO}
                            {...acessivel}
                            {...form.register(c.id, { valueAsNumber: true })}
                          />
                        ) : (
                          <input
                            type={c.tipo === "data" ? "date" : "text"}
                            maxLength={c.tipo === "texto" ? 200 : undefined}
                            className={CLASSE_DO_CAMPO}
                            {...acessivel}
                            {...form.register(c.id)}
                          />
                        )
                      }
                    </Campo>
                  );
                })}
              </div>
            );
          }}
        />
      ) : null}
    </>
  );
}
