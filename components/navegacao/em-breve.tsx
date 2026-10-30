import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type Modulo, variaveisDeCor } from "@/lib/visual/tons";

/**
 * A parte visual do "Em breve", usada pela tela inteira (`TelaEmBreve`) e pela aba da ficha
 * (`AbaEmBreve`): faixa e ícone na cor do módulo (onde a pessoa está), título, o que vai fazer e o
 * aviso. O nível do título muda com o lugar (a tela tem o `h1`; a aba entra abaixo dos da ficha).
 */
export function EmBreve({
  cor,
  icone,
  categoria,
  titulo,
  nivelDoTitulo,
  descricao,
  nota,
  aviso,
  compacto = false,
}: {
  cor: "acao" | Modulo;
  icone?: ReactNode;
  categoria?: string;
  titulo: string;
  nivelDoTitulo: "h1" | "h3";
  descricao: string;
  nota?: string;
  aviso: string;
  compacto?: boolean;
}) {
  const { forte, suave } = variaveisDeCor(cor);
  const estilo = {
    "--tom-forte": `var(${forte})`,
    "--tom-suave": `var(${suave})`,
  } as CSSProperties;
  const Titulo = nivelDoTitulo;

  return (
    <div
      style={estilo}
      className={cn("flex flex-1 items-start", compacto ? "py-6" : "px-4 py-8 sm:px-8 sm:py-10")}
    >
      <div className="flex max-w-[62ch] gap-5">
        <span aria-hidden className="w-1 shrink-0 rounded-full bg-[var(--tom-forte)]" />
        <div className="flex flex-col gap-4">
          {icone || categoria ? (
            <div className="flex items-center gap-3">
              {icone ? (
                <span className="text-texto grid size-12 place-items-center rounded-xl bg-[var(--tom-suave)]">
                  {icone}
                </span>
              ) : null}
              {categoria ? <p className="text-muted-foreground text-sm">{categoria}</p> : null}
            </div>
          ) : null}
          <Titulo
            className={cn(
              "font-semibold tracking-tight",
              nivelDoTitulo === "h1" ? "text-3xl" : "text-xl",
            )}
          >
            {titulo}
          </Titulo>
          <p className="text-muted-foreground">{descricao}</p>
          {nota ? <p className="text-muted-foreground text-sm">{nota}</p> : null}
          <p role="status" className="text-sm font-medium">
            {aviso}
          </p>
        </div>
      </div>
    </div>
  );
}
