"use client";

import { IconSearch } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { formatarInteiro } from "@/components/formato/numero";
import { useLista } from "@/components/tabela/pendencia-da-lista";
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
  /** Uma navegação está a caminho: chips e Limpar filtros não aceitam novo clique. */
  ocupada?: boolean;
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
  ocupada = false,
}: PropsVisuais) {
  const consulta = lerConsulta(parametros);
  const ativa = consultaAtiva(consulta);

  function ir(proxima: typeof consulta, substituir: boolean) {
    const texto = escreverConsulta(parametros, proxima).toString();
    aoNavegar?.(texto ? `${rota}?${texto}` : rota, substituir);
  }

  return (
    <div role="search" aria-label="Consulta" className="flex flex-wrap items-center gap-2">
      <div className="relative max-sm:w-full">
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
          className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border pr-3 pl-8 text-sm outline-none focus-visible:ring-3 sm:w-64 [&::-webkit-search-cancel-button]:hidden"
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
              disabled={ocupada}
              // Zerado e desligado fica apagado, mas clicável; ligado continua normal para poder desligar.
              data-zerado={chip.contagem === 0 && !ligado ? "true" : undefined}
              onClick={() =>
                ir({ ...consulta, chips: alternarChip(consulta.chips, chip.id) }, false)
              }
              className={cn(
                "focus-visible:ring-ring/50 flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm outline-none focus-visible:ring-3",
                chip.contagem === 0 && !ligado && "opacity-50",
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
          <Button
            variant="ghost"
            disabled={ocupada}
            onClick={() => ir({ busca: "", chips: [] }, false)}
          >
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
  const lista = useLista();
  const parametros = new URLSearchParams(lidos.toString());
  const buscaDaUrl = lerConsulta(parametros).busca;

  // O que a pessoa digita aparece na hora; a URL acompanha depois de uma pausa.
  const [rascunho, setRascunho] = useState<string | undefined>(undefined);
  const [urlAnterior, setUrlAnterior] = useState(buscaDaUrl);
  // Enquanto há texto digitado que a URL ainda não recebeu, a URL antiga não apaga o rascunho.
  const [pendente, setPendente] = useState(false);
  if (urlAnterior !== buscaDaUrl) {
    setUrlAnterior(buscaDaUrl);
    if (!pendente) setRascunho(undefined);
  }

  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A pausa da busca lê a URL de quando dispara, não a de quando a pessoa começou a digitar.
  const atuais = useRef(parametros);
  useEffect(() => {
    atuais.current = parametros;
  });
  useEffect(() => () => clearTimeout(espera.current), []);

  // Dentro de uma lista, a navegação roda na transição compartilhada: a tabela fica esmaecida.
  function navegar(url: string, substituir: boolean) {
    const ir = () => (substituir ? router.replace(url) : router.push(url));
    if (lista) lista.iniciar(ir);
    else ir();
  }

  // Ação da barra (chip, limpar filtros): vale o que a pessoa acabou de escolher, e o que ainda
  // esperava a pausa é descartado, para não desfazer a escolha depois.
  function aoNavegar(url: string, substituir: boolean) {
    clearTimeout(espera.current);
    setPendente(false);
    setRascunho(undefined);
    navegar(url, substituir);
  }

  function aoDigitar(texto: string) {
    setRascunho(texto);
    setPendente(true);
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      const base = atuais.current;
      const proxima = escreverConsulta(base, { ...lerConsulta(base), busca: texto });
      const resto = proxima.toString();
      setPendente(false);
      navegar(resto ? `${rota}?${resto}` : rota, true);
    }, ESPERA_DA_BUSCA_MS);
  }

  return (
    <BarraDeConsulta
      {...props}
      parametros={parametros}
      rota={rota}
      aoNavegar={aoNavegar}
      ocupada={lista?.pendente ?? false}
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
