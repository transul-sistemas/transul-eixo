import { Button } from "@/components/ui/button";

/**
 * As ações do momento da ficha: cada uma abre o assistente correspondente (`aoAbrir` recebe o id da
 * ação, como `frota.receber-placa`). Quem vê o quê (por perfil e pela situação da placa) é decidido
 * por quem monta a lista.
 */
export function AcoesDaFicha({
  acoes,
  aoAbrir,
}: {
  acoes: readonly { id: string; nome: string }[];
  aoAbrir: (id: string) => void;
}) {
  if (acoes.length === 0) return null;
  return (
    <div role="group" aria-label="Ações do momento" className="flex flex-wrap items-start gap-3">
      {acoes.map((acao) => (
        <Button
          key={acao.id}
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          onClick={() => aoAbrir(acao.id)}
          className="min-h-8 max-sm:min-h-11 max-sm:px-4"
        >
          {acao.nome}
        </Button>
      ))}
    </div>
  );
}
