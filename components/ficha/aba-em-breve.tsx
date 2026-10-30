import { EmBreve } from "@/components/navegacao/em-breve";
import type { Modulo } from "@/lib/visual/tons";

/** O conteúdo de uma aba da ficha que ainda não foi construída. A cor é a do módulo da raiz. */
export function AbaEmBreve({
  nome,
  descricao,
  modulo,
}: {
  nome: string;
  descricao: string;
  modulo: Modulo;
}) {
  return (
    <EmBreve
      cor={modulo}
      titulo={nome}
      nivelDoTitulo="h3"
      descricao={descricao}
      aviso="Esta aba entra em breve."
      compacto
    />
  );
}
