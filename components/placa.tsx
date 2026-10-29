import { normalizarPlaca } from "@/lib/dominio/placa";
import { cn } from "@/lib/utils";

type Tamanho = "p" | "m" | "g";

const TAMANHOS: Record<Tamanho, { faixa: string; texto: string }> = {
  p: { faixa: "h-1", texto: "px-1.5 text-xs" },
  m: { faixa: "h-1.5", texto: "px-2 text-sm" },
  g: { faixa: "h-2", texto: "px-3 text-xl" },
};

/** Mini placa Mercosul: faixa azul no alto e o texto na fonte das placas. */
export function Placa({
  placa,
  tamanho = "m",
  className,
}: {
  placa: string;
  tamanho?: Tamanho;
  className?: string;
}) {
  const texto = normalizarPlaca(placa);
  const { faixa, texto: tipografia } = TAMANHOS[tamanho];
  return (
    <span
      role="img"
      aria-label={texto ? `Placa ${texto}` : "Sem placa"}
      className={cn(
        "inline-flex flex-col overflow-hidden rounded-[4px] border border-[var(--placa-texto)]/25 bg-[var(--placa-fundo)] text-[var(--placa-texto)]",
        className,
      )}
    >
      <span aria-hidden className={cn("w-full bg-[var(--modulo-frota)]", faixa)} />
      <span
        aria-hidden
        className={cn(
          "font-placa text-center leading-tight font-semibold tracking-wider",
          tipografia,
        )}
      >
        {texto || "—"}
      </span>
    </span>
  );
}
