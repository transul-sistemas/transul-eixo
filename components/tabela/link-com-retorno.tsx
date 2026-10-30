"use client";

import { type ComponentProps, useSyncExternalStore } from "react";
import { LinkComContexto } from "@/components/navegacao/link-com-contexto";
import { espiarRetorno, urlDeVolta } from "@/lib/navegacao/retorno-da-lista";

type Props = Omit<ComponentProps<typeof LinkComContexto>, "href"> & {
  /** A lista para onde o link leva (`/frota/placas`). */
  href: string;
  /** A página onde o link está (`/frota/placas/AAA0A00`), para saber se é a ficha daquela lista. */
  rota: string;
};

const semAssinatura = () => () => {};

/**
 * Link do sistema para uma lista. Quando a pessoa está na ficha de um item daquela lista e há um
 * ponto de retorno guardado, o link leva à lista exatamente como ela estava (página, ordem e
 * filtros; a lista devolve a rolagem e o foco). Em qualquer outro caso é um link comum. O destino é
 * lido no navegador depois da hidratação (até lá vale o link comum, então o HTML do servidor não
 * muda), e por ser um link de verdade o clique do meio e o Ctrl+clique continuam funcionando.
 */
export function LinkComRetorno({ href, rota, ...resto }: Props) {
  const destino = useSyncExternalStore(
    semAssinatura,
    () => {
      try {
        return urlDeVolta(rota, href, espiarRetorno(window.sessionStorage, Date.now()));
      } catch {
        return null; // sessionStorage bloqueado: link comum
      }
    },
    () => null,
  );
  return <LinkComContexto href={destino ?? href} {...resto} />;
}
