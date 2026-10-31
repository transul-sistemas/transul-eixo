import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { acharTela } from "@/lib/navegacao/catalogo";
import { EmBreve } from "./em-breve";
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
 * Tela que ainda não foi construída: nome, ícone, cor do módulo e uma linha do que ela fará (a
 * parte visual é a de `EmBreve`).
 */
export function TelaEmBreve({ rota }: { rota: string }) {
  const achada = acharTela(rota);
  if (!achada) notFound();
  const { modulo, tela } = achada;
  return (
    <EmBreve
      cor={modulo.cor}
      icone={<IconeDoCatalogo nome={tela.icone} className="size-6" />}
      categoria={modulo.nome}
      titulo={tela.nome}
      nivelDoTitulo="h1"
      descricao={tela.descricao}
      nota={
        tela.modos
          ? `Modos previstos: ${juntarComE(tela.modos.map((modo) => modo.nome))}.`
          : undefined
      }
      aviso="Esta tela entra em breve."
    />
  );
}
