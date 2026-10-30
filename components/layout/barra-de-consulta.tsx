"use client";

import { IconSearch } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { formatarInteiro } from "@/components/formato/numero";
import { useLista } from "@/components/tabela/pendencia-da-lista";
import { useMarcarHidratacao } from "@/components/tabela/sinal-de-hidratacao";
import { Button } from "@/components/ui/button";
import { variavelDoStatus, type Status } from "@/lib/visual/tons";
import {
  alternarChip,
  consultaAtiva,
  contarFiltrosAtivos,
  escreverConsulta,
  lerConsulta,
} from "@/lib/navegacao/consulta";
import { cn } from "@/lib/utils";

export interface ChipDeConsulta {
  readonly id: string;
  readonly nome: string;
  /** Quantos itens o chip alcança. Vem pronta do banco; a tela não soma linhas. */
  readonly contagem?: number;
  /** Chips de grupos diferentes aparecem separados (cada grupo conta ignorando a própria seleção). */
  readonly grupo?: string;
  /** Tooltip do chip (por exemplo, as siglas que ele agrupa). */
  readonly dica?: string;
  /** O status da régua que o chip representa: aparece como a bolinha colorida (só nos chips de situação). */
  readonly tom?: Status;
}

/** Como um grupo de chips aparece: a caixa com título e subtítulo, a forma dos chips e o destaque da seleção. */
export interface ApresentacaoDoGrupo {
  readonly titulo: string;
  readonly subtitulo: string;
  /** Pílula (Situação) ou retângulo de canto leve (Tipo): os grupos não se confundem à vista rápida. */
  readonly forma: "pilula" | "retangulo";
  /** Seleção com fundo azul claro e borda azul (`acao`) ou com fundo escuro e texto claro (`escuro`). */
  readonly destaque: "acao" | "escuro";
}

interface PropsVisuais {
  /** Nome do campo de busca, como "Buscar placa". */
  rotulo: string;
  chips: readonly ChipDeConsulta[];
  /** Caixa, título, subtítulo, forma e destaque de cada grupo (pelo `grupo` dos chips). Sem ela, o rótulo simples. */
  apresentacaoDosGrupos?: Readonly<Record<string, ApresentacaoDoGrupo>>;
  parametros?: URLSearchParams;
  rota?: string;
  /** Chamado com a nova URL. `substituir` evita encher o histórico a cada letra digitada. */
  aoNavegar?: (url: string, substituir: boolean) => void;
  /** Texto do campo enquanto a pessoa digita (antes de ir para a URL). */
  buscaDigitada?: string;
  aoDigitar?: (texto: string) => void;
  /** Uma navegação está a caminho: chips e Limpar filtros não aceitam novo clique. */
  ocupada?: boolean;
  /** O painel de Mais filtros da tela; sem ele, o botão aparece desligado. */
  maisFiltros?: ReactNode;
  /** Parâmetros da URL que são filtros da tela (Mais filtros): contam como consulta ativa e saem no Limpar filtros. */
  filtrosExtras?: readonly string[];
}

/**
 * A barra de consulta: busca, chips com contagem, mais filtros e visões salvas. A busca e os chips
 * ficam na URL (`?q=`, `?chip=`). Mais filtros e visões salvas entram com a tabela (entrega 2C).
 */
export function BarraDeConsulta({
  rotulo,
  chips,
  apresentacaoDosGrupos = {},
  parametros = new URLSearchParams(),
  rota = "",
  aoNavegar,
  buscaDigitada,
  aoDigitar,
  ocupada = false,
  maisFiltros,
  filtrosExtras = [],
}: PropsVisuais) {
  const consulta = lerConsulta(parametros);
  const ativa = consultaAtiva(consulta) || filtrosExtras.some((chave) => parametros.has(chave));

  function ir(proxima: typeof consulta, substituir: boolean, limpandoTudo = false) {
    const novos = escreverConsulta(parametros, proxima);
    if (limpandoTudo) for (const chave of filtrosExtras) novos.delete(chave);
    const texto = novos.toString();
    aoNavegar?.(texto ? `${rota}?${texto}` : rota, substituir);
  }

  const temGrupos = chips.some((chip) => chip.grupo);
  const temCaixas = chips.some((chip) => chip.grupo && apresentacaoDosGrupos[chip.grupo]);
  const grupos = agruparChips(chips);
  const filtrosAtivos = contarFiltrosAtivos(parametros, filtrosExtras);

  function renderizarChip(chip: ChipDeConsulta, apresentacao?: ApresentacaoDoGrupo) {
    const ligado = consulta.chips.includes(chip.id);
    return (
      <button
        key={chip.id}
        type="button"
        title={chip.dica}
        aria-pressed={ligado}
        aria-disabled={ocupada ? true : undefined}
        // Zerado e desligado fica apagado, mas clicável; ligado continua normal para poder desligar.
        data-zerado={chip.contagem === 0 && !ligado ? "true" : undefined}
        onClick={() => {
          if (ocupada) return; // aria-disabled não bloqueia o clique: a guarda é aqui
          ir({ ...consulta, chips: alternarChip(consulta.chips, chip.id) }, false);
        }}
        className={cn(
          "focus-visible:ring-ring/50 flex items-center gap-1.5 border px-3 text-sm outline-none focus-visible:ring-3",
          apresentacao ? "h-7 lg:h-6" : "h-8",
          apresentacao?.forma === "retangulo" ? "rounded-md" : "rounded-full",
          chip.contagem === 0 && !ligado && "opacity-50",
          "aria-disabled:cursor-wait aria-disabled:opacity-60",
          ligado
            ? apresentacao?.destaque === "acao"
              ? "text-foreground border-[var(--acao)] bg-[var(--acao-suave)]"
              : apresentacao?.destaque === "escuro"
                ? "bg-foreground text-background border-foreground"
                : "bg-primary text-primary-foreground border-transparent"
            : "border-border bg-card hover:bg-muted",
        )}
      >
        {chip.tom ? (
          <span
            aria-hidden
            data-bolinha=""
            style={{ "--tom": `var(${variavelDoStatus(chip.tom)})` } as CSSProperties}
            className="size-2 shrink-0 rounded-full bg-[var(--tom)]"
          />
        ) : null}
        <span>{chip.nome}</span>
        {chip.contagem !== undefined ? (
          <span
            data-contagem={chip.id}
            className={cn(
              "rounded-full px-1.5 text-xs leading-5 tabular-nums",
              ligado
                ? apresentacao?.destaque === "acao"
                  ? "bg-[var(--acao)]/15"
                  : apresentacao?.destaque === "escuro"
                    ? "bg-background/20"
                    : "bg-primary-foreground/20"
                : "bg-muted text-muted-foreground",
            )}
          >
            {formatarInteiro(chip.contagem)}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div role="search" aria-label="Consulta" className="flex flex-wrap items-center gap-2">
      <div className="relative max-sm:min-w-0 max-sm:flex-1">
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

      {filtrosAtivos > 0 ? (
        <p
          role="status"
          data-filtros-ativos=""
          className="text-muted-foreground text-sm tabular-nums"
        >
          {filtrosAtivos === 1
            ? "1 filtro ativo"
            : `${formatarInteiro(filtrosAtivos)} filtros ativos`}
        </p>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {ativa ? (
          <Button
            variant="ghost"
            aria-disabled={ocupada ? true : undefined}
            className="aria-disabled:opacity-60"
            onClick={() => {
              if (ocupada) return;
              ir({ busca: "", chips: [] }, false, true);
            }}
          >
            Limpar filtros
          </Button>
        ) : null}
        {maisFiltros ?? (
          <Button variant="outline" disabled title="Entra com a tabela (entrega 2C)">
            Mais filtros
          </Button>
        )}
        <Button variant="outline" disabled title="Entra na próxima entrega">
          Visões salvas
        </Button>
      </div>

      <div
        role="group"
        aria-label="Filtros rápidos"
        className={cn(
          // Ocupa a linha toda, embaixo da busca e das ações (a ordem do HTML é a da tela).
          "flex w-full",
          // Com caixas, elas ficam empilhadas em qualquer largura (lado a lado não cabe no 1366 e
          // gastaria mais altura da tabela); sem caixas, os grupos quebram entre si.
          temCaixas
            ? "flex-col gap-1.5"
            : cn("flex-wrap items-center", temGrupos ? "gap-x-5 gap-y-2" : "gap-1.5"),
        )}
      >
        {grupos.map((grupo) => {
          const apresentacao = grupo.rotulo ? apresentacaoDosGrupos[grupo.rotulo] : undefined;
          const botoes = grupo.chips.map((chip) => renderizarChip(chip, apresentacao));
          if (apresentacao) {
            return (
              <div
                key={grupo.rotulo}
                role="group"
                aria-label={`${apresentacao.titulo}, ${apresentacao.subtitulo}`}
                className="border-border bg-card relative flex flex-col gap-1.5 overflow-hidden rounded-xl border py-1.5 pr-3 pl-4 lg:flex-row lg:items-center lg:gap-3 lg:py-1"
              >
                <span
                  aria-hidden
                  data-barra={apresentacao.destaque}
                  className={cn(
                    "absolute inset-y-0 left-0 w-1.5",
                    apresentacao.destaque === "acao" ? "bg-[var(--acao)]" : "bg-foreground",
                  )}
                />
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs lg:w-72 lg:shrink-0">
                  <span className="text-foreground font-semibold">{apresentacao.titulo}</span>
                  <span className="text-muted-foreground">{apresentacao.subtitulo}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">{botoes}</div>
              </div>
            );
          }
          return grupo.rotulo ? (
            <div
              key={grupo.rotulo}
              role="group"
              aria-label={grupo.rotulo}
              // Um grupo nunca quebra por dentro (no celular, onde não cabe, ele pode).
              className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap"
            >
              <span className="text-muted-foreground mr-0.5 text-xs">{grupo.rotulo}</span>
              {botoes}
            </div>
          ) : (
            <Fragment key="sem-grupo">{botoes}</Fragment>
          );
        })}
      </div>
    </div>
  );
}

/** Agrupa chips vizinhos do mesmo grupo, mantendo a ordem. Chips sem grupo ficam soltos. */
function agruparChips(chips: readonly ChipDeConsulta[]) {
  const grupos: { rotulo?: string; chips: ChipDeConsulta[] }[] = [];
  for (const chip of chips) {
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.rotulo === chip.grupo) ultimo.chips.push(chip);
    else grupos.push({ rotulo: chip.grupo, chips: [chip] });
  }
  return grupos;
}

const ESPERA_DA_BUSCA_MS = 250;

function Ligada(
  props: Pick<
    PropsVisuais,
    "rotulo" | "chips" | "apresentacaoDosGrupos" | "maisFiltros" | "filtrosExtras"
  >,
) {
  const rota = usePathname();
  const lidos = useSearchParams();
  const router = useRouter();
  const lista = useLista();
  useMarcarHidratacao("consulta");
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
export function BarraDeConsultaDaPagina(
  props: Pick<
    PropsVisuais,
    "rotulo" | "chips" | "apresentacaoDosGrupos" | "maisFiltros" | "filtrosExtras"
  >,
) {
  return (
    <Suspense fallback={<BarraDeConsulta {...props} />}>
      <Ligada {...props} />
    </Suspense>
  );
}
