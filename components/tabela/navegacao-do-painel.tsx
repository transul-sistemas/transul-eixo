import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { textoDaPosicao, type Vizinhas } from "@/lib/navegacao/espiar";
import { cn } from "@/lib/utils";

const CLASSE_DO_BOTAO =
  "focus-visible:ring-ring/50 hover:bg-muted inline-flex min-h-8 min-w-6 cursor-pointer items-center gap-1 rounded-lg px-2 text-sm outline-none focus-visible:ring-3";

function Botao({
  nome,
  desligado,
  aoClicar,
  children,
}: {
  nome: string;
  desligado: boolean;
  aoClicar: () => void;
  children: React.ReactNode;
}) {
  // `aria-disabled` (e não `disabled`): ao chegar na primeira ou na última, o foco fica no botão.
  return (
    <button
      type="button"
      aria-label={nome}
      aria-disabled={desligado ? "true" : undefined}
      onClick={() => {
        if (!desligado) aoClicar();
      }}
      className={cn(
        CLASSE_DO_BOTAO,
        desligado && "text-muted-foreground cursor-not-allowed opacity-50",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Placa anterior e próxima, só dentro da página atual da lista. A região de aviso fica sempre na
 * tela (só para leitor de tela): é ela que anuncia "Placa AAA0A01, 2 de 25" quando a placa troca.
 */
export function NavegacaoDoPainel({
  vizinhas,
  anuncio,
  aoIr,
}: {
  vizinhas: Vizinhas;
  /** O que o leitor de tela deve ouvir depois da última troca ("" até a primeira). */
  anuncio: string;
  aoIr: (placa: string) => void;
}) {
  return (
    <div className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1.5">
      <Botao
        nome="Placa anterior"
        desligado={vizinhas.anterior === null}
        aoClicar={() => vizinhas.anterior && aoIr(vizinhas.anterior)}
      >
        <IconChevronLeft aria-hidden className="size-4" />
        Placa anterior
      </Botao>
      <span className="text-muted-foreground text-sm tabular-nums">{textoDaPosicao(vizinhas)}</span>
      <Botao
        nome="Próxima placa"
        desligado={vizinhas.proxima === null}
        aoClicar={() => vizinhas.proxima && aoIr(vizinhas.proxima)}
      >
        Próxima placa
        <IconChevronRight aria-hidden className="size-4" />
      </Botao>
      <p role="status" className="sr-only">
        {anuncio}
      </p>
    </div>
  );
}
