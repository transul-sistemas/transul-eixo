import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { acharTela } from "@/lib/navegacao/catalogo";
import { variaveisDeCor } from "@/lib/visual/tons";
import { IconeDoCatalogo } from "./icones";

function juntarComE(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

/** Título da aba: "Placas · TranSul Eixo". Rota fora do catálogo dá erro. */
export function metadataDaTela(rota: string): Metadata {
  const achada = acharTela(rota);
  if (!achada) throw new Error(`A rota ${rota} não está no catálogo de navegação`);
  return { title: `${achada.tela.nome} · TranSul Eixo` };
}

/**
 * Tela que ainda não foi construída: nome, ícone, cor do módulo e uma linha do que ela fará.
 * A cor do módulo aparece na faixa e no fundo do ícone; o ícone e o texto ficam na cor do texto.
 */
export function TelaEmBreve({ rota }: { rota: string }) {
  const achada = acharTela(rota);
  if (!achada) notFound();
  const { modulo, tela } = achada;
  const { forte, suave } = variaveisDeCor(modulo.cor);
  const estilo = {
    "--tom-forte": `var(${forte})`,
    "--tom-suave": `var(${suave})`,
  } as CSSProperties;

  return (
    <div style={estilo} className="flex flex-1 items-start px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex max-w-[62ch] gap-5">
        <span aria-hidden className="w-1 shrink-0 rounded-full bg-[var(--tom-forte)]" />
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-texto grid size-12 place-items-center rounded-xl bg-[var(--tom-suave)]">
              <IconeDoCatalogo nome={tela.icone} className="size-6" />
            </span>
            <p className="text-muted-foreground text-sm">{modulo.nome}</p>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{tela.nome}</h1>
          <p className="text-muted-foreground">{tela.descricao}</p>
          {tela.modos ? (
            <p className="text-muted-foreground text-sm">
              Modos previstos: {juntarComE(tela.modos.map((modo) => modo.nome))}.
            </p>
          ) : null}
          <p role="status" className="text-sm font-medium">
            Esta tela entra em breve.
          </p>
        </div>
      </div>
    </div>
  );
}
