import { IconArrowLeft } from "@tabler/icons-react";
import { LinkComContexto } from "@/components/navegacao/link-com-contexto";

/** O caminho de volta da ficha: a lista de placas. */
export function VoltarALista() {
  return (
    <LinkComContexto
      href="/frota/placas"
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-8 items-center gap-1.5 rounded-lg text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3"
    >
      <IconArrowLeft aria-hidden className="size-4" />
      Voltar à lista
    </LinkComContexto>
  );
}
