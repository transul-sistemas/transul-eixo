import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// A grade de 12 colunas dos painéis de apoio: a soma das larguras de uma linha fecha em 12 (8 + 4,
// 6 + 6, 4 + 4 + 4), então nunca sobra um cartão de um terço com o resto vazio. Abaixo de 1024 px
// os painéis empilham, sem rolagem horizontal.

export type Colunas = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;

const LARGURAS: Record<Colunas, string> = {
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  9: "lg:col-span-9",
  12: "lg:col-span-12",
};

export function GradeDePaineis({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-12", className)}>
      {children}
    </div>
  );
}

/** Uma célula da grade: `colunas` de 12 a partir de 1024 px. */
export function CelulaDaGrade({ colunas, children }: { colunas: Colunas; children: ReactNode }) {
  return (
    <div data-colunas={colunas} className={cn("flex min-w-0 flex-col", LARGURAS[colunas])}>
      {children}
    </div>
  );
}

/** Confere que cada linha da grade soma 12 colunas (usado pelos testes e pelo desenvolvimento). */
export function linhasFecham(larguras: readonly Colunas[]): boolean {
  let soma = 0;
  for (const l of larguras) {
    soma += l;
    if (soma > 12) return false;
    if (soma === 12) soma = 0;
  }
  return soma === 0;
}
