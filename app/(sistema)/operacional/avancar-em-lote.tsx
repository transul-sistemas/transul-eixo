"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Resolver } from "react-hook-form";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Button } from "@/components/ui/button";
import { Assistente } from "@/components/wizard/assistente";
import {
  type AcaoEmLote,
  esquemaAvancarEmLote,
  textoDoLote,
} from "@/lib/dominio/esquemas/operacional";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { errosDoResolvedor } from "../frota/placas/assistentes/erros-do-resolvedor";
import { avancarEmLoteAcao, type ResultadoDoLote } from "./acoes";

// Ação em lote do Pátio e das Ordens (popup): escolher as placas DESTA PÁGINA que a situação permite,
// conferir e gravar. Cada placa é um pedido independente; o resultado diz "X de Y" e o motivo de cada
// recusa, numa faixa que fica na tela depois de fechar.

export interface PlacaDoLote {
  ativoId: string;
  placa: string;
}

const NOMES: Record<AcaoEmLote, { botao: string; titulo: string }> = {
  aceitar: { botao: "Aceitar placas", titulo: "Aceitar placas em lote" },
  concluir: { botao: "Concluir carregamentos", titulo: "Concluir carregamentos em lote" },
  liberar: { botao: "Liberar viagens", titulo: "Liberar viagens em lote" },
};

const EFEITOS: Record<AcaoEmLote, string> = {
  aceitar: "As placas ficam aguardando carregamento (ACe).",
  concluir: "As ordens das placas ficam carregadas, aguardando a nota (CAn).",
  liberar: "As ordens ficam em viagem e as placas voltam à custódia do gestor de frota (ETc).",
};

interface Valores {
  ativoIds: string[];
}

export function AvancarEmLote({ acao, placas }: { acao: AcaoEmLote; placas: PlacaDoLote[] }) {
  const usuario = useUsuarioDaSessao();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDoLote | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  if (placas.length === 0) return null;
  const nome = NOMES[acao];
  const escolhidas = (v: Valores) => placas.filter((p) => v.ativoIds.includes(p.ativoId));
  const definicao: DefinicaoDeAssistente = {
    id: `lote-${acao}`,
    titulo: nome.titulo,
    versaoDoEsquema: 1,
    passos: [
      { id: "placas", titulo: "Placas", campos: ["ativoIds"] },
      { id: "conferir", titulo: "Conferir", campos: [] },
    ],
  };
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaAvancarEmLote.safeParse({ acao, placas: escolhidas(valores) });
    return r.success
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<Valores>([
            { path: ["ativoIds"], message: r.error.issues[0]?.message ?? "Confira as placas." },
          ]),
        };
  };
  return (
    <div className="flex flex-col gap-2">
      <Button
        ref={botao}
        variant="outline"
        onClick={() => {
          setResultado(null);
          setAberto(true);
        }}
      >
        {nome.botao} ({placas.length})
      </Button>
      {resultado ? (
        <div role="status" className="bg-muted rounded-lg px-3 py-2 text-sm">
          <p className="font-medium">{textoDoLote(acao, resultado.feitas, resultado.total)}</p>
          {resultado.recusadas.length > 0 ? (
            <ul className="text-muted-foreground mt-1 list-disc pl-5">
              {resultado.recusadas.map((r) => (
                <li key={r.placa}>
                  {r.placa}: {r.mensagem}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {aberto ? (
        <Assistente<Valores>
          definicao={definicao}
          resolver={resolver}
          valoresIniciais={{ ativoIds: placas.map((p) => p.ativoId) }}
          validarRascunho={() => null}
          usuario={usuario}
          rascunho={false}
          focoFinal={botao}
          rotuloConcluir={nome.botao}
          mensagemConcluido="Lote gravado."
          fecharAoGravar
          aoConcluir={(v, chaveDeEnvio) =>
            avancarEmLoteAcao({ chaveDeEnvio, dados: { acao, placas: escolhidas(v) } })
          }
          aoGravar={(linha) => {
            setResultado(linha as ResultadoDoLote);
            router.refresh();
          }}
          aoFechar={() => setAberto(false)}
          resumo={(v) => [
            {
              titulo: "Placas",
              linhas: [
                {
                  rotulo: "Escolhidas",
                  valor: `${v.ativoIds.length} de ${placas.length} desta página`,
                },
                {
                  rotulo: "Placas",
                  valor: escolhidas(v)
                    .map((p) => p.placa)
                    .join(", "),
                },
              ],
            },
          ]}
          efeitos={() => [
            EFEITOS[acao],
            "Cada placa grava sozinha: se uma for recusada, as outras seguem e a tela diz qual e por quê.",
          ]}
          renderPasso={(_passo, form) => (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm">
                Placas desta página que podem seguir (a seleção vale só para esta página)
              </legend>
              {placas.map((p) => (
                <label
                  key={p.ativoId}
                  className="hover:bg-muted flex min-h-9 items-center gap-2 rounded-md px-2 text-sm"
                >
                  <input
                    type="checkbox"
                    value={p.ativoId}
                    className="size-4"
                    {...form.register("ativoIds")}
                  />
                  <span className="font-semibold">{p.placa}</span>
                </label>
              ))}
              <p role="alert" className="text-destructive min-h-4 text-xs">
                {form.formState.errors.ativoIds?.message}
              </p>
            </fieldset>
          )}
        />
      ) : null}
    </div>
  );
}
