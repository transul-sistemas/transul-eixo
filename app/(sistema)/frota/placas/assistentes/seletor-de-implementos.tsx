"use client";

import { IconX } from "@tabler/icons-react";
import { useId, useState } from "react";
import type { CandidatoDoConjunto } from "@/lib/dados/escrita-tipos";
import { CLASSE_DO_CAMPO } from "@/components/wizard/campos";

// Os implementos do conjunto do cavalo (o mestre): busca, lista com rolagem interna de altura fixa,
// contador de escolhidos e os escolhidos fixados no topo, fora da rolagem. O conjunto misto de
// carrocerias é barrado pelo esquema (a mensagem chega em `erro`).

const SEM_ACENTO = /[̀-ͯ]/g;
const simples = (texto: string) => texto.normalize("NFD").replace(SEM_ACENTO, "").toLowerCase();

export function SeletorDeImplementos({
  candidatos,
  valor,
  aoMudar,
  erro,
}: {
  candidatos: readonly CandidatoDoConjunto[];
  valor: readonly string[];
  aoMudar: (ids: string[]) => void;
  erro?: string;
}) {
  const id = useId();
  const [busca, setBusca] = useState("");
  const escolhidos = candidatos.filter((c) => valor.includes(c.id));
  const termo = simples(busca.trim());
  const visiveis = termo ? candidatos.filter((c) => simples(c.nome).includes(termo)) : candidatos;
  const alterar = (candidato: CandidatoDoConjunto, marcado: boolean) =>
    aoMudar(marcado ? [...valor, candidato.id] : valor.filter((x) => x !== candidato.id));

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-muted-foreground mb-1 text-sm">Implementos do conjunto</legend>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Buscar implemento"
          placeholder="Buscar por placa ou carroceria"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          // Enter no campo de busca não avança o assistente.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          autoComplete="off"
          className={`${CLASSE_DO_CAMPO} min-w-0 flex-1`}
        />
        <p
          data-testid="contador-de-escolhidos"
          role="status"
          className="text-muted-foreground text-sm whitespace-nowrap"
        >
          {escolhidos.length} {escolhidos.length === 1 ? "escolhido" : "escolhidos"}
        </p>
      </div>

      {escolhidos.length > 0 ? (
        <ul
          aria-label="Implementos escolhidos"
          className="border-border flex flex-wrap gap-2 rounded-[10px] border bg-[var(--acao-suave)] p-2"
        >
          {escolhidos.map((c) => (
            <li
              key={c.id}
              className="bg-card border-border flex items-center gap-1 rounded-lg border py-1 pr-1 pl-2.5 text-sm"
            >
              <span>{c.nome}</span>
              <button
                type="button"
                aria-label={`Tirar ${c.nome}`}
                onClick={() => alterar(c, false)}
                className="hover:bg-muted focus-visible:ring-ring/50 grid size-7 place-items-center rounded-md outline-none focus-visible:ring-3 max-sm:size-9"
              >
                <IconX aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        data-testid="lista-de-implementos"
        aria-label="Implementos livres"
        // Altura fixa: a lista rola por dentro e o passo não cresce com ela.
        className="border-border h-56 overflow-y-auto rounded-[10px] border"
        role="group"
      >
        {candidatos.length === 0 ? (
          <p className="text-muted-foreground p-3 text-sm">
            Nenhum implemento livre para este conjunto.
          </p>
        ) : visiveis.length === 0 ? (
          <p className="text-muted-foreground p-3 text-sm">
            Nenhum implemento combina com a busca. Tire parte do texto.
          </p>
        ) : (
          visiveis.map((c) => (
            <label
              key={c.id}
              htmlFor={`${id}-${c.id}`}
              className="hover:bg-muted/60 flex min-h-9 cursor-pointer items-center gap-2 px-3 text-sm max-sm:min-h-11"
            >
              <input
                id={`${id}-${c.id}`}
                type="checkbox"
                className="size-4"
                checked={valor.includes(c.id)}
                onChange={(e) => alterar(c, e.target.checked)}
              />
              <span>{c.nome}</span>
            </label>
          ))
        )}
      </div>
      <p role="alert" className="text-destructive min-h-4 text-xs">
        {erro}
      </p>
    </fieldset>
  );
}
