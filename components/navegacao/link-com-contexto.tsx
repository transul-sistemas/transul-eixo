"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ComponentProps, Suspense } from "react";
import { anexarContexto } from "@/lib/navegacao/contexto";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

function ComContexto({ href, ...resto }: Props) {
  const parametros = useSearchParams();
  const destino = anexarContexto(href, new URLSearchParams(parametros?.toString() ?? ""));
  return <Link href={destino} {...resto} />;
}

/**
 * Link do sistema que leva o contexto global (período, filial, operação, regime) da URL atual para
 * a tela de destino. Até a página hidratar vale o link comum, então o HTML do servidor não muda.
 */
export function LinkComContexto(props: Props) {
  return (
    <Suspense fallback={<Link {...props} />}>
      <ComContexto {...props} />
    </Suspense>
  );
}
