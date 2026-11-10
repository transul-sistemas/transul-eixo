"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { LinkComRetorno } from "@/components/tabela/link-com-retorno";
import { ROTA_DOS_PARCEIROS } from "@/lib/navegacao/parceiros";

/** O caminho de volta da ficha: a lista de parceiros, no ponto em que a pessoa saiu dela, se houver. */
export function VoltarALista() {
  const rota = usePathname();
  return (
    <LinkComRetorno
      href={ROTA_DOS_PARCEIROS}
      rota={rota}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-8 items-center gap-1.5 rounded-lg text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3"
    >
      <IconArrowLeft aria-hidden className="size-4" />
      Voltar à lista
    </LinkComRetorno>
  );
}
