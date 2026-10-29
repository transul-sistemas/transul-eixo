import type { ReactNode } from "react";

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
}

/**
 * Esqueleto de leitura de toda tela de dados, na ordem do CLAUDE.md: contexto global (no topo do
 * sistema) → título e ações → barra de consulta → KPIs → conteúdo. Largura total; só o texto
 * corrido da descrição é limitado.
 */
export function PaginaDeLeitura({ titulo, descricao, acoes, consulta, kpis, children }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
          {descricao ? <p className="text-muted-foreground max-w-[62ch]">{descricao}</p> : null}
        </div>
        {acoes ? (
          <div role="group" aria-label="Ações" className="flex flex-wrap items-center gap-2">
            {acoes}
          </div>
        ) : null}
      </div>
      {consulta}
      {kpis}
      <div className="flex min-w-0 flex-1 flex-col gap-8">{children}</div>
    </div>
  );
}
