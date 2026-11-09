"use client";

import { type RefObject } from "react";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO, GradeDeCampos } from "@/components/wizard/campos";
import type { Catalogos, PlacaGravada } from "@/lib/dados/escrita-tipos";
import { paraEntradaDaCorrecao } from "@/lib/dados/entradas-dos-assistentes";
import { esquemaCorrigirPlaca } from "@/lib/dominio/esquemas/ficha-da-placa";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { cn } from "@/lib/utils";
import { corrigirPlacaAcao } from "../acoes";
import { resolvedorDoEsquema } from "./resolvedor-da-ficha";

const CLASSE_DO_TEXTO = cn(CLASSE_DO_CAMPO, "h-auto py-2 max-sm:h-auto");

// Corrigir placa: completa o RENAVAM e o número de série (só o que falta: chave preenchida não
// troca) e corrige os eixos e a carroceria, com o motivo. Deixe vazio o que não quer mexer.

interface Valores {
  renavam: string;
  numeroDeSerie: string;
  eixos: string;
  carroceriaId: string;
  motivo: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "corrigir-placa",
  titulo: "Corrigir placa",
  versaoDoEsquema: 1,
  passos: [
    {
      id: "campos",
      titulo: "O que corrigir",
      campos: ["renavam", "numeroDeSerie", "eixos", "carroceriaId"],
    },
    { id: "motivo", titulo: "Motivo", campos: ["motivo"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function CorrigirPlaca({
  placa,
  catalogos,
  aoFechar,
  focoFinal,
}: {
  placa: PlacaGravada;
  catalogos: Catalogos;
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const entrada = (v: Valores) => ({
    ...paraEntradaDaCorrecao({ ...v }),
    placa: placa.placa,
    versaoDaPlaca: placa.versao,
    motivo: v.motivo,
  });
  const semRenavam = placa.renavam === "";
  // Sem o campo do RENAVAM na tela, o aviso de "preencha ao menos um" vai para o primeiro campo.
  const resolver = resolvedorDoEsquema<Valores>(esquemaCorrigirPlaca, entrada, (path) =>
    path[0] === "renavam" && !semRenavam ? ["numeroDeSerie"] : path,
  );
  const carroceria = (id: string) => catalogos.carrocerias.find((c) => c.id === id)?.nome ?? "";
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{ renavam: "", numeroDeSerie: "", eixos: "", carroceriaId: "", motivo: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={placa.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Corrigir placa"
      mensagemConcluido="Placa corrigida."
      aoConcluir={(valores, chaveDeEnvio) =>
        corrigirPlacaAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={() => (
        <p>A placa mudou desde que você a abriu. Feche e abra de novo para ver como está.</p>
      )}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Placa",
          linhas: [{ rotulo: "Placa", valor: placa.placa }],
        },
        {
          titulo: "Correção",
          linhas: [
            { rotulo: "RENAVAM", valor: v.renavam?.trim() },
            { rotulo: "Número de série", valor: v.numeroDeSerie?.trim() },
            { rotulo: "Eixos", valor: v.eixos?.trim() },
            { rotulo: "Carroceria", valor: v.carroceriaId ? carroceria(v.carroceriaId) : "" },
            { rotulo: "Motivo", valor: v.motivo?.trim() },
          ].filter((l) => l.valor),
        },
      ]}
      efeitos={() => [
        "Eixos e carroceria ficam como correção local: o valor, o motivo, quem corrigiu e o valor de antes, que dá para revogar.",
        "RENAVAM e número de série só são preenchidos quando faltam; trocar um já preenchido não é permitido.",
        "A mudança entra na auditoria da placa.",
      ]}
      renderPasso={(passo, form) =>
        passo.id === "campos" ? (
          <>
            <GradeDeCampos>
              {semRenavam ? (
                <Campo rotulo="RENAVAM" erro={form.formState.errors.renavam?.message}>
                  {(p) => (
                    <input
                      {...p}
                      {...form.register("renavam")}
                      inputMode="numeric"
                      className={CLASSE_DO_CAMPO}
                    />
                  )}
                </Campo>
              ) : null}
              <Campo rotulo="Número de série" erro={form.formState.errors.numeroDeSerie?.message}>
                {(p) => (
                  <input {...p} {...form.register("numeroDeSerie")} className={CLASSE_DO_CAMPO} />
                )}
              </Campo>
              <Campo rotulo="Eixos" erro={form.formState.errors.eixos?.message}>
                {(p) => (
                  <input
                    {...p}
                    {...form.register("eixos")}
                    inputMode="numeric"
                    className={CLASSE_DO_CAMPO}
                  />
                )}
              </Campo>
              <Campo rotulo="Carroceria" erro={form.formState.errors.carroceriaId?.message}>
                {(p) => (
                  <select {...p} {...form.register("carroceriaId")} className={CLASSE_DO_CAMPO}>
                    <option value="">Não mexer</option>
                    {catalogos.carrocerias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
            </GradeDeCampos>
          </>
        ) : (
          <Campo
            rotulo="Motivo"
            erro={form.formState.errors.motivo?.message}
            ajuda="Por que o dado está sendo completado ou corrigido, como a conferência com o CRLV."
          >
            {(p) => (
              <textarea {...p} {...form.register("motivo")} rows={4} className={CLASSE_DO_TEXTO} />
            )}
          </Campo>
        )
      }
    />
  );
}
