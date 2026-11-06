"use client";

import { type RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { Catalogos, PlacaGravada } from "@/lib/dados/escrita-tipos";
import { esquemaDisponibilizarPlaca } from "@/lib/dominio/esquemas/placa";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { disponibilizarPlacaAcao } from "../acoes";
import { cn } from "@/lib/utils";
import { errosDoResolvedor } from "./erros-do-resolvedor";

const CLASSE_DO_TEXTO = cn(CLASSE_DO_CAMPO, "h-auto py-2 max-sm:h-auto");

// Disponibilizar placa: o gestor de frota envia a placa a outro gestor de frota, com o motivo e as
// pendências que já conhece. A placa só muda de carteira quando quem recebe conclui o recebimento.

interface Valores {
  paraGestorId: string;
  motivo: string;
  /** Uma pendência por linha. */
  pendencias: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "disponibilizar-placa",
  titulo: "Disponibilizar placa",
  versaoDoEsquema: 1,
  passos: [
    { id: "destino", titulo: "Destino e motivo", campos: ["paraGestorId", "motivo"] },
    { id: "pendencias", titulo: "Pendências", campos: ["pendencias", "pendenciasConhecidas"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

const linhas = (texto: string) =>
  texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

export function DisponibilizarPlaca({
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
  const destinos = catalogos.gestores.filter((g) => g.id !== placa.gestorId);
  const entrada = (v: Valores) => ({
    placa: placa.placa,
    paraGestorId: v.paraGestorId,
    motivo: v.motivo,
    pendenciasConhecidas: linhas(v.pendencias ?? ""),
    versaoDaPlaca: placa.versao,
  });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaDisponibilizarPlaca.safeParse(entrada(valores));
    const problemas = r.success
      ? []
      : r.error.issues.map((i) => ({
          // As pendências viram um campo de texto só: o erro de qualquer linha aparece nele.
          path: i.path[0] === "pendenciasConhecidas" ? ["pendencias"] : i.path,
          message: i.message,
        }));
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<Valores>(problemas) };
  };
  const nomeDoGestor = (id: string) => catalogos.gestores.find((g) => g.id === id)?.nome ?? "";
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{ paraGestorId: "", motivo: "", pendencias: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={placa.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Disponibilizar placa"
      mensagemConcluido="Placa disponibilizada. Ela muda de carteira quando quem recebe concluir o recebimento."
      aoConcluir={(valores, chaveDeEnvio) =>
        disponibilizarPlacaAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={() => (
        <p>A placa mudou desde que você a abriu. Feche e abra de novo para ver como está.</p>
      )}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Destino",
          linhas: [
            { rotulo: "Placa", valor: placa.placa },
            { rotulo: "Sai de", valor: placa.gestor },
            { rotulo: "Vai para", valor: nomeDoGestor(v.paraGestorId) },
            { rotulo: "Motivo", valor: v.motivo?.trim() },
          ],
        },
        {
          titulo: "Pendências",
          linhas: [{ rotulo: "Pendências", valor: String(linhas(v.pendencias ?? "").length) }],
        },
      ]}
      efeitos={(v) => [
        <>
          <b>{nomeDoGestor(v.paraGestorId) || "Quem vai receber"}</b> vê a placa em &quot;Para
          receber&quot; e registra a chegada.
        </>,
        "A placa continua na sua carteira até quem recebe concluir o recebimento, respondendo cada pendência.",
        "Enquanto o pedido estiver aberto, a placa não pode ser disponibilizada de novo.",
      ]}
      renderPasso={(passo, form) =>
        passo.id === "destino" ? (
          <>
            <Campo
              rotulo="Gestor que vai receber"
              erro={form.formState.errors.paraGestorId?.message}
            >
              {(p) => (
                <select {...p} {...form.register("paraGestorId")} className={CLASSE_DO_CAMPO}>
                  <option value="">Escolha…</option>
                  {destinos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Motivo" erro={form.formState.errors.motivo?.message}>
              {(p) => (
                <textarea
                  {...p}
                  {...form.register("motivo")}
                  rows={3}
                  className={CLASSE_DO_TEXTO}
                />
              )}
            </Campo>
          </>
        ) : (
          <Campo
            rotulo="Pendências conhecidas"
            erro={form.formState.errors.pendencias?.message}
            ajuda="Uma por linha, como documento vencendo ou revisão em aberto. Deixe vazio se não há."
          >
            {(p) => (
              <textarea
                {...p}
                {...form.register("pendencias")}
                rows={5}
                className={CLASSE_DO_TEXTO}
              />
            )}
          </Campo>
        )
      }
    />
  );
}
