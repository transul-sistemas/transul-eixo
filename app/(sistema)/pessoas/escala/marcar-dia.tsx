"use client";

import type { RefObject } from "react";
import { formatarData } from "@/components/formato/data";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import type { PessoaDaEscala } from "@/lib/dados/pessoas-tipos";
import { esquemaMarcarEscala, SIGLAS_DA_ESCALA } from "@/lib/dominio/esquemas/pessoa";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { resolvedorPor } from "../lista/campos-da-pessoa";
import { marcarEscalaAcao } from "./acoes";

// Marcar dia (mini-assistente lateral, aberto pela célula da escala): escolher a marcação do dia
// (trabalho, folga, férias ou atestado), conferir e gravar. Uma marcação por pessoa e dia: marcar de
// novo troca a do dia, com a versão que a pessoa viu.

interface Valores {
  sigla: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "marcar-dia-da-escala",
  titulo: "Marcar dia",
  versaoDoEsquema: 1,
  passos: [
    { id: "marcacao", titulo: "Marcação", campos: ["sigla"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

const nomeDa = (sigla: string | undefined) => SIGLAS_DA_ESCALA.find((s) => s.id === sigla)?.nome;

export function MarcarDia({
  pessoa,
  operacaoId,
  dia,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  pessoa: PessoaDaEscala;
  operacaoId: string;
  dia: string;
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const atual = pessoa.dias[dia] ?? null;
  const entrada = (v: Valores) => ({
    pessoaId: pessoa.id,
    operacaoId,
    dia,
    sigla: v.sigla,
    versao: atual?.versao ?? null,
  });
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      variante="lateral"
      resolver={resolvedorPor<Valores>(esquemaMarcarEscala, ["sigla"], entrada)}
      valoresIniciais={{ sigla: atual?.sigla ?? "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={`${pessoa.id}-${dia}`}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Marcar dia"
      mensagemConcluido="Dia marcado."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(valores, chaveDeEnvio) =>
        marcarEscalaAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={() => (
        <p>
          A marcação deste dia mudou desde que você abriu a escala. Feche e abra o dia de novo para
          ver como ele está.
        </p>
      )}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Dia da escala",
          linhas: [
            { rotulo: "Pessoa", valor: pessoa.nome },
            { rotulo: "Dia", valor: formatarData(dia) },
            {
              rotulo: "Antes",
              valor: atual ? `${atual.sigla} · ${nomeDa(atual.sigla)}` : "Sem marcação",
            },
            { rotulo: "Marcar", valor: v.sigla ? `${v.sigla} · ${nomeDa(v.sigla)}` : "—" },
          ],
        },
      ]}
      efeitos={() => [
        "Cada pessoa tem uma marcação por dia: esta substitui a que houver.",
        "A marcação vale para a operação da escala aberta.",
      ]}
      renderPasso={(_, form) => {
        const erro = form.formState.errors.sigla?.message;
        return (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm">
              Marcação de {pessoa.nome} em {formatarData(dia)}
            </legend>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {SIGLAS_DA_ESCALA.map((s) => (
                <label
                  key={s.id}
                  className="hover:bg-muted flex min-h-9 items-center gap-2 rounded-md px-2 text-sm max-sm:min-h-11"
                >
                  <input type="radio" value={s.id} className="size-4" {...form.register("sigla")} />
                  <span className="font-semibold">{s.id}</span>
                  <span className="text-muted-foreground">{s.nome}</span>
                </label>
              ))}
            </div>
            <p role="alert" className="text-destructive min-h-4 text-xs">
              {erro}
            </p>
          </fieldset>
        );
      }}
    />
  );
}
