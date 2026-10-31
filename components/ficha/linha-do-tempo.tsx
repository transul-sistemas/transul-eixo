import type { CSSProperties } from "react";
import { Etiqueta } from "@/components/etiqueta";
import { formatarData } from "@/components/formato/data";
import { formatarDuracao } from "@/components/formato/duracao";
import type { Segmento } from "@/lib/dominio/linha-do-tempo";
import { NOMES_DAS_SIGLAS } from "@/lib/dominio/status";
import { variavelDoStatus } from "@/lib/visual/tons";

/** Abaixo desta fatia da janela a faixa é estreita demais para a sigla caber escrita. */
const FATIA_MINIMA_PARA_O_TEXTO = 0.07;

function resumoDasFaixas(segmentos: readonly Segmento[]): string {
  return segmentos
    .map((s) =>
      s.sigla === null
        ? `sem registro por ${formatarDuracao(s.minutos)}`
        : `${s.sigla} (${NOMES_DAS_SIGLAS[s.sigla]}) por ${formatarDuracao(s.minutos)}`,
    )
    .join("; ");
}

/**
 * A linha do tempo horizontal de uma raiz, colorida pela régua de status: cada faixa pesa pelos
 * minutos que durou, na cor suave do grupo com a linha forte embaixo (cor sólida só no modo TV). A
 * informação não depende da cor: a sigla vem escrita nas faixas largas, há legenda com o nome e a
 * aba "Linha do tempo" traz a mesma coisa em lista.
 */
export function LinhaDoTempo({
  segmentos,
  de,
  ate,
  nome,
}: {
  segmentos: readonly Segmento[];
  /** O começo e o fim da janela, `aaaa-mm-ddThh:mm`. */
  de: string;
  ate: string;
  /** De quem é a linha (a placa), para o nome acessível. */
  nome: string;
}) {
  if (segmentos.length === 0) {
    return <p className="text-muted-foreground text-sm">Sem registro no período.</p>;
  }
  const total = segmentos.reduce((soma, s) => soma + s.minutos, 0);
  const rotulo = `Linha do tempo de ${nome}, de ${formatarData(de)} a ${formatarData(ate)}: ${resumoDasFaixas(segmentos)}.`;
  const vistas = new Set<string>();
  const legenda = segmentos.filter((s) => {
    const chave = s.sigla ?? "sem-registro";
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });

  return (
    <figure className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={rotulo}
        className="border-border bg-card flex h-9 overflow-hidden rounded-lg border"
      >
        {segmentos.map((s) => {
          const estilo = {
            flex: `${s.minutos} 1 0%`,
            minWidth: "3px",
            ...(s.grupo
              ? {
                  "--tom-forte": `var(${variavelDoStatus(s.grupo)})`,
                  "--tom-suave": `var(${variavelDoStatus(s.grupo)}-suave)`,
                }
              : {}),
          } as CSSProperties;
          const escreve = s.sigla !== null && s.minutos / total >= FATIA_MINIMA_PARA_O_TEXTO;
          return (
            <div
              key={`${s.de}-${s.sigla ?? "sem-registro"}`}
              data-faixa=""
              {...(s.sigla ? { "data-sigla": s.sigla } : {})}
              data-grupo={s.grupo ?? "sem-registro"}
              title={`${s.sigla ?? "Sem registro"}, ${formatarDuracao(s.minutos)}`}
              style={estilo}
              className={
                s.grupo
                  ? "text-texto flex items-center justify-center overflow-hidden border-b-[3px] border-[var(--tom-forte)] bg-[var(--tom-suave)] text-xs font-semibold"
                  : "bg-muted text-muted-foreground flex items-center justify-center overflow-hidden border-b-[3px] border-transparent text-xs"
              }
            >
              {escreve ? <span aria-hidden>{s.sigla}</span> : null}
            </div>
          );
        })}
      </div>
      <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
        <span>{formatarData(de)}</span>
        <span>{formatarData(ate)}</span>
      </div>
      <ul data-legenda="" className="flex flex-wrap gap-x-4 gap-y-1.5">
        {legenda.map((s) => (
          <li key={s.sigla ?? "sem-registro"}>
            {s.grupo && s.sigla ? (
              <Etiqueta status={s.grupo}>
                <span className="font-semibold">{s.sigla}</span>
                <span>{NOMES_DAS_SIGLAS[s.sigla]}</span>
              </Etiqueta>
            ) : (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                <span aria-hidden className="bg-muted size-1.5 rounded-full" />
                Sem registro
              </span>
            )}
          </li>
        ))}
      </ul>
    </figure>
  );
}
