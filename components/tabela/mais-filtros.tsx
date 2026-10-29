"use client";

import { Popover } from "@base-ui/react/popover";
import { IconFilter } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic } from "react";
import type { Sigla } from "@/lib/dominio/status";
import {
  alternarSigla,
  contarFiltrosAvancados,
  gruposDeSiglas,
} from "@/lib/navegacao/filtros-avancados";
import { lerTabela, mudarConsulta, type PadraoDaTabela } from "@/lib/navegacao/tabela";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLista } from "./pendencia-da-lista";

interface Props {
  padrao: PadraoDaTabela;
  campos: readonly string[];
}

const GRUPOS = gruposDeSiglas();

/**
 * Mais filtros da lista de placas: a sigla exata (o chip é só o agrupamento) e o "inclui baixadas"
 * (VND e SUC). Tudo na URL (`sigla`, `baixadas`); mudar qualquer um volta à página 1. Enquanto uma
 * navegação está a caminho, o painel não aceita novo clique.
 */
export function MaisFiltrosDePlacas({ padrao, campos }: Props) {
  const rota = usePathname();
  const parametros = useSearchParams();
  const router = useRouter();
  const lista = useLista();
  const ocupado = lista?.pendente ?? false;

  const daUrl = lerTabela(new URLSearchParams(parametros.toString()), padrao, campos);
  // A caixa muda na hora; quando a URL chega, o valor real assume (e desfaz se a navegação falhar).
  const [atual, marcarNaHora] = useOptimistic(
    { siglas: daUrl.siglas, baixadas: daUrl.baixadas },
    (estado, parcial: { siglas?: Sigla[]; baixadas?: boolean }) => ({ ...estado, ...parcial }),
  );
  const quantos = contarFiltrosAvancados(atual);

  function mudar(parcial: { siglas?: Sigla[]; baixadas?: boolean }) {
    const novos = mudarConsulta(
      new URLSearchParams(parametros.toString()),
      parcial,
      padrao,
      campos,
    ).toString();
    const ir = () => {
      marcarNaHora(parcial);
      router.push(novos ? `${rota}?${novos}` : rota, { scroll: false });
    };
    if (lista) lista.iniciar(ir);
    else ir();
  }

  return (
    <Popover.Root>
      <Popover.Trigger className={cn(buttonVariants({ variant: "outline" }))}>
        <IconFilter aria-hidden className="size-3.5" />
        Mais filtros
        {quantos > 0 ? (
          <span
            data-testid="quantos-filtros-avancados"
            className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs leading-5 tabular-nums"
          >
            {quantos}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={6} className="z-50">
          <Popover.Popup className="border-border bg-popover text-popover-foreground flex max-h-[85dvh] w-[26rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border shadow-lg outline-none">
            <div className="flex shrink-0 flex-col gap-1 p-3 pb-2">
              <Popover.Title className="text-sm font-semibold">Mais filtros</Popover.Title>
              <Popover.Description className="text-muted-foreground text-xs">
                Escolha a sigla exata. Os chips da barra só agrupam as siglas.
              </Popover.Description>
              <label className="hover:bg-muted mt-1 flex items-start gap-2 rounded-md px-2 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={atual.baixadas}
                  disabled={ocupado}
                  onChange={() => mudar({ baixadas: !atual.baixadas })}
                  className="mt-0.5 size-4"
                />
                <span>
                  Inclui baixadas (VND e SUC)
                  <span className="text-muted-foreground block text-xs">
                    Placas vendidas e sucateadas ficam fora da lista, salvo com esta opção.
                  </span>
                </span>
              </label>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-2">
              {GRUPOS.map((grupo) => (
                <div
                  key={grupo.id}
                  role="group"
                  aria-label={grupo.nome}
                  className="flex flex-col gap-0.5"
                >
                  <p className="text-muted-foreground px-2 text-xs font-medium">{grupo.nome}</p>
                  {grupo.siglas.map((item) => (
                    <label
                      key={item.sigla}
                      className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={atual.siglas.includes(item.sigla)}
                        disabled={ocupado}
                        onChange={() => mudar({ siglas: alternarSigla(atual.siglas, item.sigla) })}
                        className="size-4"
                      />
                      <span>
                        <span className="font-semibold">{item.sigla}</span> {item.nome}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div className="border-border bg-popover shrink-0 border-t p-3">
              <button
                type="button"
                disabled={ocupado || quantos === 0}
                onClick={() => mudar({ siglas: [], baixadas: false })}
                className="border-input hover:bg-muted focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
              >
                Limpar seleção
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
