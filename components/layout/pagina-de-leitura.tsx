import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AvisoDeDadosCongelados } from "./aviso-de-dados-congelados";

interface Props {
  titulo: string;
  descricao?: string;
  /** Botões da tela (receber, exportar...), no canto direito do título. */
  acoes?: ReactNode;
  /** A barra de consulta: busca, chips com contagem, mais filtros e visões salvas. */
  consulta?: ReactNode;
  /** A faixa de indicadores. */
  kpis?: ReactNode;
  children: ReactNode;
  /** A data limite do staging (`aaaa-mm-dd`), nas telas que mostram número dele: vira o aviso "dados até". */
  dadosAte?: string | null;
  /**
   * Tela de lista: a descrição sai da vista e a tabela guarda a própria rolagem (cabeçalho e primeira
   * coluna fixos). A página rola como as outras; só no modo foco ela tem a altura da janela.
   */
  lista?: boolean;
  /** Modo foco: esconde a barra lateral e o topo para a tabela ocupar a tela. */
  emFoco?: boolean;
  /**
   * Grade que cabe na janela: a página trava na altura da janela e nunca rola na vertical (a grade é o que
   * rola, por dentro), e abaixo de 1440 px a barra lateral recolhe sozinha. Só vale com `lista`.
   */
  alturaFixa?: boolean;
}

/**
 * Esqueleto de leitura de toda tela de dados, na ordem do CLAUDE.md: contexto global (no topo do
 * sistema) → título e ações → barra de consulta → KPIs → conteúdo. Largura total; só o texto
 * corrido da descrição é limitado.
 */
export function PaginaDeLeitura({
  titulo,
  descricao,
  acoes,
  consulta,
  kpis,
  children,
  dadosAte,
  lista = false,
  emFoco = false,
  alturaFixa = false,
}: Props) {
  return (
    <div
      data-tela-de-lista={lista ? "" : undefined}
      data-modo-foco={lista && emFoco ? "" : undefined}
      data-grade-fixa={lista && alturaFixa ? "" : undefined}
      className={cn(
        "flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8",
        lista && "min-h-0 lg:gap-4 lg:py-4",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
          {descricao ? (
            // Na lista a altura é preciosa: a descrição sai da vista, mas fica para o leitor de tela.
            <p className={cn("text-muted-foreground max-w-[62ch]", lista && "sr-only")}>
              {descricao}
            </p>
          ) : null}
        </div>
        {acoes ? (
          <div role="group" aria-label="Ações" className="flex flex-wrap items-center gap-2">
            {acoes}
          </div>
        ) : null}
      </div>
      <AvisoDeDadosCongelados dadosAte={dadosAte} />
      {consulta}
      {kpis}
      <div className={cn("flex min-w-0 flex-1 flex-col gap-8", lista && "min-h-0 lg:gap-3")}>
        {children}
      </div>
    </div>
  );
}
