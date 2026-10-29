import { useSyncExternalStore } from "react";

// A partir de 1024 px (lg do Tailwind) o menu é uma barra lateral; abaixo disso, uma gaveta.
const CONSULTA = "(min-width: 1024px)";

function assinar(ouvinte: () => void): () => void {
  const consulta = window.matchMedia(CONSULTA);
  consulta.addEventListener("change", ouvinte);
  return () => consulta.removeEventListener("change", ouvinte);
}

/** Verdadeiro em tela de computador. O servidor assume computador, e o navegador corrige. */
export function useTelaGrande(): boolean {
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(CONSULTA).matches,
    () => true,
  );
}
