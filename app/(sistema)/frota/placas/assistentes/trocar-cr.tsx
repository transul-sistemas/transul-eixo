"use client";

import type { RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { Etiqueta } from "@/components/etiqueta";
import { formatarData, hojeEmSaoPaulo } from "@/components/formato/data";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import { CarregarParaAbrir } from "@/components/wizard/carregar-para-abrir";
import type { CrDoCatalogo } from "@/lib/dados/escrita-tipos";
import type { VinculosDaPlaca } from "@/lib/dados/vinculos-da-placa-tipos";
import { esquemaTrocarCr, ORIGENS_DA_DATA } from "@/lib/dominio/esquemas/dia-cr-e-baixa";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { vinculosDaPlacaAcao, trocarCrAcao } from "../acoes-de-vinculo";
import { errosDoResolvedor } from "./erros-do-resolvedor";

// Trocar CR (V0, quadro tarefas-e-vinculos/2): o CR atual fecha e o novo abre na MESMA data, sem
// buraco; a placa muda de operação; nada é apagado (nucleo.trocar_cr, com a versão do vínculo vigente).
// Passos: CR atual, Novo CR, Data e motivo, Conferir (antes encerrado em vermelho suave; depois vigente
// em verde).

interface Valores {
  vinculoId: string;
  crNovoId: string;
  dia: string;
  origemDaData: (typeof ORIGENS_DA_DATA)[number];
  motivo: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "trocar-cr",
  titulo: "Trocar CR",
  versaoDoEsquema: 1,
  passos: [
    { id: "atual", titulo: "CR atual", campos: ["vinculoId"] },
    { id: "novo", titulo: "Novo CR", campos: ["crNovoId"] },
    { id: "data", titulo: "Data e motivo", campos: ["dia", "origemDaData", "motivo"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

const NOMES_DA_ORIGEM: Record<(typeof ORIGENS_DA_DATA)[number], string> = {
  informada: "Informada por mim",
  observada: "Observada (documento ou sistema)",
  derivada: "Derivada de outro dado",
};

function TrocarCrDaPlaca({
  dados,
  crs,
  aoFechar,
  focoFinal,
}: {
  dados: VinculosDaPlaca;
  crs: readonly CrDoCatalogo[];
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const vigentes = dados.vinculos.filter((v) => v.vigente);
  const vinculo = (id: string) => vigentes.find((v) => v.vinculo_id === id);
  const codigo = (id: string) => crs.find((c) => c.id === id)?.codigo ?? "";
  const entrada = (v: Valores) => ({
    ativoId: dados.ativoId,
    crNovoId: v.crNovoId,
    dia: v.dia,
    motivo: v.motivo,
    origemDaData: v.origemDaData,
    versao: vinculo(v.vinculoId)?.versao ?? null,
  });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaTrocarCr.safeParse(entrada(valores));
    const problemas = r.success
      ? []
      : r.error.issues.map((i) => ({ path: i.path, message: i.message }));
    if (valores.crNovoId !== "" && vinculo(valores.vinculoId)?.cr_id === valores.crNovoId)
      problemas.push({ path: ["crNovoId"], message: "Escolha um CR diferente do atual." });
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<Valores>(problemas) };
  };
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{
        vinculoId: vigentes[0]?.vinculo_id ?? "",
        crNovoId: "",
        dia: hojeEmSaoPaulo(new Date()),
        origemDaData: "informada",
        motivo: "",
      }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={dados.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Trocar CR"
      mensagemConcluido="CR trocado."
      aoConcluir={(v, chaveDeEnvio) => trocarCrAcao({ chaveDeEnvio, dados: entrada(v) })}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: `Placa ${dados.placa}`,
          linhas: [
            { rotulo: "Sai", valor: vinculo(v.vinculoId)?.codigo ?? "Sem CR vigente" },
            { rotulo: "Entra", valor: codigo(v.crNovoId) },
            { rotulo: "Na data", valor: v.dia ? formatarData(v.dia) : "" },
            { rotulo: "Motivo", valor: v.motivo },
          ],
        },
      ]}
      efeitos={(v) => {
        const atual = vinculo(v.vinculoId);
        return [
          <span key="antes" className="flex flex-wrap items-center gap-2">
            Antes:
            {atual ? (
              <Etiqueta status="impedida">
                {atual.codigo} encerrado em {v.dia ? formatarData(v.dia) : "—"}
              </Etiqueta>
            ) : (
              "sem CR vigente deste tipo"
            )}
          </span>,
          <span key="depois" className="flex flex-wrap items-center gap-2">
            Depois:
            <Etiqueta status="em-atividade">
              {codigo(v.crNovoId) || "—"} vigente desde {v.dia ? formatarData(v.dia) : "—"}
            </Etiqueta>
          </span>,
          "O antigo fecha e o novo abre na mesma data, sem buraco; a placa passa à operação do CR novo.",
          v.dia && v.dia < hojeEmSaoPaulo(new Date())
            ? "A data é passada: a troca entra como correção tardia e mexe nos meses já lançados."
            : "Nada é apagado: a história do CR guarda as duas vigências.",
        ];
      }}
      renderPasso={(passo, form) => {
        if (passo.id === "atual")
          return (
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-2">Qual CR de {dados.placa} sai?</legend>
              {vigentes.length === 0 ? (
                <p className="text-muted-foreground">
                  A placa não tem CR vigente. Continue para escolher o primeiro.
                </p>
              ) : (
                vigentes.map((v) => (
                  <label key={v.vinculo_id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      value={v.vinculo_id}
                      className="size-4"
                      {...form.register("vinculoId")}
                    />
                    <span className="font-medium">{v.codigo}</span>
                    <span className="text-muted-foreground">
                      {v.tipo} · {v.operacao ?? "sem operação"} · desde {formatarData(v.inicio)}
                    </span>
                    <Etiqueta status="em-atividade">Vigente</Etiqueta>
                  </label>
                ))
              )}
              {dados.vinculos.some((v) => !v.vigente) ? (
                <details className="text-muted-foreground mt-2">
                  <summary>
                    Ver a história ({dados.vinculos.filter((v) => !v.vigente).length})
                  </summary>
                  <ul className="mt-1 flex flex-col gap-1">
                    {dados.vinculos
                      .filter((v) => !v.vigente)
                      .map((v) => (
                        <li key={v.vinculo_id} className="flex flex-wrap items-center gap-2">
                          {v.codigo} · {formatarData(v.inicio)} a{" "}
                          {v.fim ? formatarData(v.fim) : "—"}
                          <Etiqueta status="impedida">Encerrado</Etiqueta>
                        </li>
                      ))}
                  </ul>
                </details>
              ) : null}
            </fieldset>
          );
        if (passo.id === "novo")
          return (
            <Campo rotulo="Novo CR" erro={form.formState.errors.crNovoId?.message}>
              {(p) => (
                <select {...p} {...form.register("crNovoId")} className={CLASSE_DO_CAMPO}>
                  <option value="">Escolha…</option>
                  {crs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          );
        return (
          <>
            <Campo rotulo="Data da troca" erro={form.formState.errors.dia?.message}>
              {(p) => (
                <input {...p} {...form.register("dia")} type="date" className={CLASSE_DO_CAMPO} />
              )}
            </Campo>
            <Campo rotulo="De onde vem a data" erro={form.formState.errors.origemDaData?.message}>
              {(p) => (
                <select {...p} {...form.register("origemDaData")} className={CLASSE_DO_CAMPO}>
                  {ORIGENS_DA_DATA.map((o) => (
                    <option key={o} value={o}>
                      {NOMES_DA_ORIGEM[o]}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Motivo" erro={form.formState.errors.motivo?.message}>
              {(p) => <input {...p} {...form.register("motivo")} className={CLASSE_DO_CAMPO} />}
            </Campo>
          </>
        );
      }}
    />
  );
}

export function TrocarCr({
  placa,
  crs,
  aoFechar,
  focoFinal,
}: {
  placa: string;
  crs: readonly CrDoCatalogo[];
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  return (
    <CarregarParaAbrir
      titulo="Trocar CR"
      ler={() => vinculosDaPlacaAcao(placa)}
      vazio={(d) => (d === null ? `Não achamos a placa ${placa}. Confira a placa.` : null)}
      aoFechar={aoFechar}
    >
      {(d) =>
        d === null ? null : (
          <TrocarCrDaPlaca
            dados={d}
            crs={crs}
            aoFechar={aoFechar}
            {...(focoFinal ? { focoFinal } : {})}
          />
        )
      }
    </CarregarParaAbrir>
  );
}
