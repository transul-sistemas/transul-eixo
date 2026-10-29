"use client";

import { IconSearch } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { formatarInteiro } from "@/components/formato/numero";
import { Button } from "@/components/ui/button";
import {
  alternarChip,
  consultaAtiva,
  escreverConsulta,
  lerConsulta,
} from "@/lib/navegacao/consulta";
import { cn } from "@/lib/utils";

export interface ChipDeConsulta {
  readonly id: string;
  readonly nome: string;
  /** Quantos itens o chip alcança. Vem pronta do banco; a tela não soma linhas. */
  readonly contagem?: number;
}

interface PropsVisuais {
  /** Nome do campo de busca, como "Buscar placa". */
  rotulo: string;
  chips: readonly ChipDeConsulta[];
  parametros?: URLSearchParams;
  rota?: string;
  /** Chamado com a nova URL. `substituir` evita encher o histórico a cada letra digitada. */
  aoNavegar?: (url: string, substituir: boolean) => void;
  /** Texto do campo enquanto a pessoa digita (antes de ir para a URL). */
  buscaDigitada?: string;
  aoDigitar?: (texto: string) => void;
}

/**
 * A barra de consulta: busca, chips com contagem, mais filtros e visões salvas. A busca e os chips
 * ficam na URL (`?q=`, `?chip=`). Mais filtros e visões salvas entram com a tabela (entrega 2C).
 */
export function BarraDeConsulta({
  rotulo,
  chips,
  parametros = new URLSearchParams(),
  rota = "",
  aoNavegar,
  buscaDigitada,
  aoDigitar,
}: PropsVisuais) {
  const consulta = lerConsulta(parametros);
  const ativa = consultaAtiva(consulta);

  function ir(proxima: typeof consulta, substituir: boolean) {
    const texto = escreverConsulta(parametros, proxima).toString();
    aoNavegar?.(texto ? `${rota}?${texto}` : rota, substituir);
  }

  return (
    <div role="search" aria-label="Consulta" className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <IconSearch
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-4"
        />
        <input
          type="search"
          aria-label={rotulo}
          placeholder={rotulo}
          value={buscaDigitada ?? consulta.busca}
          onChange={(evento) => aoDigitar?.(evento.target.value)}
          className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-64 rounded-lg border pr-3 pl-8 text-sm outline-none focus-visible:ring-3 [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      <div
        role="group"
        aria-label="Filtros rápidos"
        className="flex flex-wrap items-center gap-1.5"
      >
        {chips.map((chip) => {
          const ligado = consulta.chips.includes(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={ligado}
              onClick={() =>
                ir({ ...consulta, chips: alternarChip(consulta.chips, chip.id) }, false)
              }
              className={cn(
                "focus-visible:ring-ring/50 flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm outline-none focus-visible:ring-3",
                ligado
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <span>{chip.nome}</span>
              {chip.contagem !== undefined ? (
                <span
                  data-contagem={chip.id}
                  className={cn(
                    "rounded-full px-1.5 text-xs leading-5 tabular-nums",
                    ligado ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                  )}
                >
                  {formatarInteiro(chip.contagem)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {ativa ? (
          <Button variant="ghost" onClick={() => ir({ busca: "", chips: [] }, false)}>
            Limpar filtros
          </Button>
        ) : null}
        <Button variant="outline" disabled title="Entra com a tabela (entrega 2C)">
          Mais filtros
        </Button>
        <Button variant="outline" disabled title="Entra com a tabela (entrega 2C)">
          Visões salvas
        </Button>
      </div>
    </div>
  );
}

const ESPERA_DA_BUSCA_MS = 250;

function Ligada(props: Pick<PropsVisuais, "rotulo" | "chips">) {
  const rota = usePathname();
  const lidos = useSearchParams();
  const router = useRouter();
  const parametros = new URLSearchParams(lidos.toString());
  const buscaDaUrl = lerConsulta(parametros).busca;

  // O que a pessoa digita aparece na hora; a URL acompanha depois de uma pausa.
  const [rascunho, setRascunho] = useState<string | undefined>(undefined);
  const [urlAnterior, setUrlAnterior] = useState(buscaDaUrl);
  if (urlAnterior !== buscaDaUrl) {
    setUrlAnterior(buscaDaUrl);
    setRascunho(undefined);
  }

  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(espera.current), []);

  function aoNavegar(url: string, substituir: boolean) {
    if (substituir) router.replace(url);
    else router.push(url);
  }

  function aoDigitar(texto: string) {
    setRascunho(texto);
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      const proxima = escreverConsulta(parametros, { ...lerConsulta(parametros), busca: texto });
      const resto = proxima.toString();
      aoNavegar(resto ? `${rota}?${resto}` : rota, true);
    }, ESPERA_DA_BUSCA_MS);
  }

  return (
    <BarraDeConsulta
      {...props}
      parametros={parametros}
      rota={rota}
      aoNavegar={aoNavegar}
      buscaDigitada={rascunho}
      aoDigitar={aoDigitar}
    />
  );
}

/** A barra de consulta ligada à URL da página: use esta nas telas. */
export function BarraDeConsultaDaPagina(props: Pick<PropsVisuais, "rotulo" | "chips">) {
  return (
    <Suspense fallback={<BarraDeConsulta {...props} />}>
      <Ligada {...props} />
    </Suspense>
  );
}
