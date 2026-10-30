import { Button } from "@/components/ui/button";

/**
 * As ações do momento da ficha. Toda escrita é feita por assistente (entrega 2D), então até lá cada
 * ação aparece desligada com `aria-disabled` (o foco continua no botão) e a mensagem visível. Quem
 * vê o quê (por perfil) é decidido por quem monta a lista.
 */
export function AcoesDaFicha({ acoes }: { acoes: readonly { id: string; nome: string }[] }) {
  if (acoes.length === 0) return null;
  return (
    <div role="group" aria-label="Ações do momento" className="flex flex-wrap items-start gap-3">
      {acoes.map((acao) => {
        const dica = `dica-${acao.id.replace(/[^a-z0-9-]/gi, "-")}`;
        return (
          <div key={acao.id} className="flex flex-col gap-1">
            <Button
              type="button"
              variant="outline"
              aria-disabled="true"
              aria-describedby={dica}
              onClick={(evento) => evento.preventDefault()}
              className="min-h-8 cursor-not-allowed opacity-60"
            >
              {acao.nome}
            </Button>
            <span id={dica} className="text-muted-foreground text-xs">
              chega com os assistentes (2D)
            </span>
          </div>
        );
      })}
    </div>
  );
}
