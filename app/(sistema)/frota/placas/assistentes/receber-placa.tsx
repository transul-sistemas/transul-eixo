"use client";

import { type RefObject, useMemo } from "react";
import { Controller, type Resolver, type UseFormReturn } from "react-hook-form";
import { CampoMoeda, Moeda } from "@/components/formato/moeda";
import { Assistente } from "@/components/wizard/assistente";
import {
  Campo,
  CampoComMais,
  CLASSE_DO_CAMPO,
  type OpcaoDeSelecao,
} from "@/components/wizard/campos";
import type { DadosDosAssistentes } from "@/lib/dados/escrita-tipos";
import { paraEntradaDoRecebimento } from "@/lib/dados/entradas-dos-assistentes";
import type { Catalogos, ItemCriado, PlacaGravada } from "@/lib/dados/escrita-tipos";
import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import { esquemaRecebimento, siglasIniciaisDoTipo } from "@/lib/dominio/esquemas/placa";
import { NOMES_DAS_SIGLAS, type Sigla } from "@/lib/dominio/status";
import { USUARIO_PROVISORIO } from "@/lib/navegacao/perfis";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { receberPlacaAcao } from "../acoes";
import { errosDoResolvedor } from "./erros-do-resolvedor";
import { ACAO_DO_MAIS, renderizarMini } from "./mini-cadastro-de-catalogo";

// Receber placa: o gestor de destino confere o que chega, resolve as pendências que o gestor de
// origem deixou, define situação, posse e conjunto, e conclui. Confere a versão do pedido e a da placa.

export interface ValoresDoRecebimento {
  conferido: boolean;
  pendencias: { id: string; resolvida: boolean }[];
  situacao: string;
  operacaoId: string;
  crId: string;
  motoristaId: string;
  metaDoConjuntoCentavos: number;
  conjunto: { cavaloId: string; implementoIds: string[] };
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "receber-placa",
  titulo: "Receber placa",
  versaoDoEsquema: 1,
  passos: [
    { id: "chegada", titulo: "Chegada", campos: ["conferido", "pendencias"] },
    { id: "situacao", titulo: "Situação", campos: ["situacao", "operacaoId", "crId"] },
    {
      id: "conjunto",
      titulo: "Conjunto e motorista",
      campos: ["conjunto", "motoristaId", "metaDoConjuntoCentavos"],
    },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

const COM_MOTORISTA = ["cavalo", "caminhao", "apoio"];

export function ReceberPlaca({
  placa,
  pedido,
  candidatos,
  catalogos,
  hoje,
  aoItemCriado,
  aoFechar,
  focoFinal,
}: {
  placa: PlacaGravada;
  pedido: PedidoDeTransferencia;
  candidatos: DadosDosAssistentes["candidatosDoConjunto"];
  catalogos: Catalogos;
  hoje: string;
  aoItemCriado: (item: ItemCriado) => void;
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const esquema = useMemo(() => esquemaRecebimento(placa.tipo), [placa.tipo]);
  const situacoes = siglasIniciaisDoTipo(placa.tipo);
  const valoresIniciais: ValoresDoRecebimento = {
    conferido: false,
    pendencias: pedido.pendenciasConhecidas.map((p) => ({ id: p.id, resolvida: false })),
    situacao: situacoes.includes(placa.sigla) ? placa.sigla : (situacoes[0] as string),
    operacaoId: placa.operacaoId ?? "",
    crId: placa.crId ?? "",
    motoristaId: placa.motoristaId ?? "",
    metaDoConjuntoCentavos: placa.metaDoConjuntoCentavos ?? 0,
    conjunto: {
      cavaloId: placa.conjunto.cavaloId ?? "",
      implementoIds: [...placa.conjunto.implementoIds],
    },
  };
  const entrada = (v: ValoresDoRecebimento) => ({
    ...paraEntradaDoRecebimento(v as never),
    placa: placa.placa,
    pedidoId: pedido.id,
    versaoDoPedido: pedido.versao,
    versaoDaPlaca: placa.versao,
  });
  const resolver: Resolver<ValoresDoRecebimento> = async (valores) => {
    const r = esquema.safeParse(entrada(valores));
    return r.success
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<ValoresDoRecebimento>(
            r.error.issues.map((i) => ({ path: i.path, message: i.message })),
          ),
        };
  };
  const nome = (lista: readonly OpcaoDeSelecao[], id: string) =>
    lista.find((o) => o.id === id)?.nome ?? "";
  const textoDaPendencia = (id: string) =>
    pedido.pendenciasConhecidas.find((p) => p.id === id)?.texto ?? id;
  void hoje;

  return (
    <Assistente<ValoresDoRecebimento>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={valoresIniciais}
      validarRascunho={() => null}
      usuario={USUARIO_PROVISORIO}
      registro={placa.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Receber placa"
      mensagemConcluido="Placa recebida."
      aoConcluir={(valores, chaveDeEnvio) =>
        receberPlacaAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={(atual) => {
        const a = atual as Partial<PlacaGravada & PedidoDeTransferencia>;
        return a.situacao === "pendente" || a.sigla === undefined ? (
          <p>O pedido mudou desde que você o abriu. Feche e abra de novo para ver como está.</p>
        ) : (
          <p>
            Agora a placa {a.placa} está em {a.sigla} · {NOMES_DAS_SIGLAS[a.sigla as Sigla]}.
          </p>
        );
      }}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Chegada",
          linhas: [
            { rotulo: "Placa", valor: placa.placa },
            { rotulo: "Motivo", valor: pedido.motivo },
            {
              rotulo: "Pendências resolvidas",
              valor: `${v.pendencias.filter((p) => p.resolvida).length} de ${v.pendencias.length}`,
            },
            { rotulo: "Conferido", valor: v.conferido ? "Sim" : "Não" },
          ],
        },
        {
          titulo: "Situação",
          linhas: [
            {
              rotulo: "Situação",
              valor: v.situacao
                ? `${v.situacao} · ${NOMES_DAS_SIGLAS[v.situacao as Sigla] ?? ""}`
                : "",
            },
            { rotulo: "Operação", valor: nome(catalogos.operacoes, v.operacaoId) },
            {
              rotulo: "CR",
              valor: catalogos.crs.find((c) => c.id === v.crId)?.codigo ?? "",
            },
          ],
        },
        {
          titulo: "Conjunto e motorista",
          linhas: [
            ...(placa.tipo === "implemento"
              ? [{ rotulo: "Cavalo", valor: nome(candidatos, v.conjunto.cavaloId) }]
              : []),
            ...(placa.tipo === "cavalo"
              ? [
                  {
                    rotulo: "Implementos",
                    valor: v.conjunto.implementoIds.map((id) => nome(candidatos, id)).join(", "),
                  },
                  {
                    rotulo: "Meta do conjunto",
                    valor:
                      v.metaDoConjuntoCentavos > 0 ? (
                        <Moeda valor={v.metaDoConjuntoCentavos} />
                      ) : (
                        ""
                      ),
                  },
                ]
              : []),
            ...(COM_MOTORISTA.includes(placa.tipo)
              ? [{ rotulo: "Motorista", valor: nome(catalogos.motoristas, v.motoristaId) }]
              : []),
          ],
        },
      ]}
      renderPasso={(passo, form) => (
        <PassoDoRecebimento
          passo={passo.id}
          form={form}
          placa={placa}
          pedido={pedido}
          candidatos={candidatos}
          catalogos={catalogos}
          situacoes={situacoes}
          textoDaPendencia={textoDaPendencia}
          aoItemCriado={aoItemCriado}
        />
      )}
    />
  );
}

function PassoDoRecebimento({
  passo,
  form,
  placa,
  pedido,
  candidatos,
  catalogos,
  situacoes,
  textoDaPendencia,
  aoItemCriado,
}: {
  passo: string;
  form: UseFormReturn<ValoresDoRecebimento>;
  placa: PlacaGravada;
  pedido: PedidoDeTransferencia;
  candidatos: DadosDosAssistentes["candidatosDoConjunto"];
  catalogos: Catalogos;
  situacoes: readonly Sigla[];
  textoDaPendencia: (id: string) => string;
  aoItemCriado: (item: ItemCriado) => void;
}) {
  const erros = form.formState.errors;
  const operacaoId = form.watch("operacaoId");
  if (passo === "chegada") {
    const pendencias = form.watch("pendencias");
    const erroDasPendencias = (erros.pendencias as { message?: string } | undefined)?.message;
    const erroDoConferido = erros.conferido?.message;
    return (
      <>
        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <p className="text-muted-foreground">Motivo da transferência</p>
          <p data-testid="motivo-da-transferencia">{pedido.motivo}</p>
        </div>
        {pedido.pendenciasConhecidas.length > 0 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-muted-foreground mb-1 text-sm">
              Pendências que o gestor deixou
            </legend>
            {pedido.pendenciasConhecidas.map((p, i) => (
              <label key={p.id} className="flex min-h-9 items-center gap-2 text-sm max-sm:min-h-11">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={pendencias[i]?.resolvida ?? false}
                  onChange={(e) => form.setValue(`pendencias.${i}.resolvida`, e.target.checked)}
                />
                <span>Resolvida: {textoDaPendencia(p.id)}</span>
              </label>
            ))}
            <p role="alert" className="text-destructive min-h-4 text-xs">
              {erroDasPendencias}
            </p>
          </fieldset>
        ) : null}
        <div className="flex flex-col gap-1">
          <label className="flex min-h-9 items-center gap-2 text-sm max-sm:min-h-11">
            <input
              type="checkbox"
              className="size-4"
              aria-invalid={erroDoConferido ? true : undefined}
              {...form.register("conferido")}
            />
            <span>Conferi o que chegou</span>
          </label>
          <p role="alert" className="text-destructive min-h-4 text-xs">
            {erroDoConferido}
          </p>
        </div>
      </>
    );
  }

  if (passo === "situacao") {
    const crs = catalogos.crs
      .filter((c) => c.operacaoId === operacaoId)
      .map((c) => ({ id: c.id, nome: c.codigo }));
    return (
      <>
        <Campo rotulo="Situação" erro={erros.situacao?.message}>
          {(p) => (
            <select {...p} {...form.register("situacao")} className={CLASSE_DO_CAMPO}>
              {situacoes.map((sigla) => (
                <option key={sigla} value={sigla}>
                  {sigla} · {NOMES_DAS_SIGLAS[sigla]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Controller
          control={form.control}
          name="operacaoId"
          render={({ field }) => (
            <CampoComMais
              rotulo="Operação"
              rotuloDoMais={ACAO_DO_MAIS("operacao")}
              opcoes={catalogos.operacoes}
              valor={field.value}
              aoMudar={(id) => {
                if (id !== field.value) form.setValue("crId", "");
                field.onChange(id);
              }}
              erro={erros.operacaoId?.message}
              renderMini={(m) => renderizarMini(m, "operacao", undefined, aoItemCriado)}
            />
          )}
        />
        <Controller
          control={form.control}
          name="crId"
          render={({ field }) => (
            <CampoComMais
              rotulo="CR"
              rotuloDoMais={ACAO_DO_MAIS("cr")}
              opcoes={crs}
              valor={field.value}
              aoMudar={field.onChange}
              erro={erros.crId?.message}
              desligadoPorque={operacaoId ? undefined : "Escolha a operação primeiro."}
              semOpcao="Esta operação ainda não tem CR. Use o + para cadastrar."
              renderMini={(m) => renderizarMini(m, "cr", operacaoId, aoItemCriado)}
            />
          )}
        />
      </>
    );
  }

  // conjunto e motorista
  const implementos = form.watch("conjunto.implementoIds");
  const erroDoImplemento = (erros.conjunto?.implementoIds as { message?: string } | undefined)
    ?.message;
  return (
    <>
      {placa.tipo === "implemento" ? (
        <Campo rotulo="Cavalo do conjunto" erro={erros.conjunto?.cavaloId?.message}>
          {(p) => (
            <select {...p} {...form.register("conjunto.cavaloId")} className={CLASSE_DO_CAMPO}>
              <option value="">Sem cavalo</option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          )}
        </Campo>
      ) : null}
      {placa.tipo === "cavalo" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-muted-foreground mb-1 text-sm">Implementos do conjunto</legend>
          {candidatos.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum implemento livre para este conjunto.
            </p>
          ) : null}
          {candidatos.map((c) => (
            <label key={c.id} className="flex min-h-9 items-center gap-2 text-sm max-sm:min-h-11">
              <input
                type="checkbox"
                className="size-4"
                checked={implementos.includes(c.id)}
                onChange={(e) =>
                  form.setValue(
                    "conjunto.implementoIds",
                    e.target.checked
                      ? [...implementos, c.id]
                      : implementos.filter((id) => id !== c.id),
                    { shouldDirty: true },
                  )
                }
              />
              <span>{c.nome}</span>
            </label>
          ))}
          <p role="alert" className="text-destructive min-h-4 text-xs">
            {erroDoImplemento}
          </p>
        </fieldset>
      ) : null}
      {COM_MOTORISTA.includes(placa.tipo) ? (
        <Campo rotulo="Motorista" erro={erros.motoristaId?.message}>
          {(p) => (
            <select {...p} {...form.register("motoristaId")} className={CLASSE_DO_CAMPO}>
              <option value="">Sem motorista</option>
              {catalogos.motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          )}
        </Campo>
      ) : null}
      {placa.tipo === "cavalo" ? (
        <Controller
          control={form.control}
          name="metaDoConjuntoCentavos"
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <CampoMoeda rotulo="Meta do conjunto" valor={field.value} onChange={field.onChange} />
              <p role="alert" className="text-destructive min-h-4 text-xs">
                {erros.metaDoConjuntoCentavos?.message}
              </p>
            </div>
          )}
        />
      ) : null}
      {placa.tipo !== "cavalo" &&
      placa.tipo !== "implemento" &&
      !COM_MOTORISTA.includes(placa.tipo) ? (
        <p className="text-muted-foreground text-sm">
          Este tipo de ativo não tem conjunto nem motorista.
        </p>
      ) : null}
    </>
  );
}
