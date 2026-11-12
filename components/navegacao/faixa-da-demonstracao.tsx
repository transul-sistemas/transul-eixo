import { IconFlask } from "@tabler/icons-react";
import { connection } from "next/server";
import { bancoEmDemonstracao } from "@/lib/dados/faixa-da-demonstracao";

export const TEXTO_DA_FAIXA = "Banco em demonstração: números fictícios misturados com os reais";

/**
 * A faixa fixa no topo que avisa que o banco tem dados fictícios de demonstração. Só desenha quando
 * está ligada; o topo do sistema desce a altura dela (`group-has-[[data-faixa-demo]]/casca:top-8`).
 */
export function FaixaDaDemonstracao({ ligada }: { ligada: boolean }) {
  if (!ligada) return null;
  return (
    <div
      role="note"
      data-faixa-demo=""
      data-testid="faixa-da-demonstracao"
      className="bg-primary text-primary-foreground sticky top-0 z-30 flex h-8 items-center justify-center gap-2 px-4 text-sm font-medium group-has-[[data-modo-foco]]/casca:hidden"
    >
      <IconFlask aria-hidden className="size-4 shrink-0" />
      {TEXTO_DA_FAIXA}
    </div>
  );
}

/** A leitura é dinâmica (depende da sessão), então fica atrás do `connection()`, dentro de um Suspense. */
export async function FaixaDaDemonstracaoDaSessao() {
  await connection();
  return <FaixaDaDemonstracao ligada={await bancoEmDemonstracao()} />;
}
