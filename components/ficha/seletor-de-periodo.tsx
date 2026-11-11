import { IconAlertTriangle } from "@tabler/icons-react";
import Link from "next/link";
import { formatarMes } from "@/components/formato/data";
import { ROTULO_DE_MES_INCOMPLETO } from "@/components/layout/aviso-de-dados-congelados";
import { MODOS_DO_ACUMULADO, type Periodo } from "@/lib/dominio/periodo";
import { enderecoDoPeriodo } from "@/lib/navegacao/operacoes";
import { cn } from "@/lib/utils";

const CLASSE =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm tabular-nums outline-none focus-visible:ring-3";
const ATIVO = "bg-primary text-primary-foreground hover:bg-primary";

/**
 * O seletor de período da ficha: um chip por mês fechado e, ao lado, o acumulado (ano até aqui,
 * últimos 12 meses, todos os meses). O período vai para a URL (`mes=` ou `acum=`).
 */
export function SeletorDePeriodo({
  rota,
  parametros,
  meses,
  atual,
  mesIncompleto = null,
}: {
  rota: string;
  parametros: URLSearchParams;
  /** Os meses `aaaa-mm` a oferecer, do mais antigo ao mais recente. */
  meses: readonly string[];
  atual: Periodo;
  /** O mês `aaaa-mm` com dados só até o meio: aparece por último, rotulado como incompleto. */
  mesIncompleto?: string | null;
}) {
  const lista =
    mesIncompleto && !meses.includes(mesIncompleto) ? [...meses, mesIncompleto] : [...meses];
  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Mês do resultado" className="flex flex-wrap gap-2">
        {lista.map((mes) => {
          const ativo = atual.tipo === "mes" && atual.mes === mes;
          return (
            <Link
              key={mes}
              href={enderecoDoPeriodo(rota, parametros, { tipo: "mes", mes })}
              aria-current={ativo ? "page" : undefined}
              className={cn(CLASSE, ativo && ATIVO)}
            >
              {formatarMes(mes)}
              {mes === mesIncompleto ? (
                <span className="ml-2 inline-flex items-center gap-1 text-xs">
                  <IconAlertTriangle aria-hidden className="size-3.5" />
                  {ROTULO_DE_MES_INCOMPLETO}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <nav aria-label="Acumulado" className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Acumulado</span>
        {MODOS_DO_ACUMULADO.map((m) => {
          const ativo = atual.tipo === "acumulado" && atual.modo === m.id;
          return (
            <Link
              key={m.id}
              href={enderecoDoPeriodo(rota, parametros, { tipo: "acumulado", modo: m.id })}
              aria-current={ativo ? "page" : undefined}
              className={cn(CLASSE, ativo && ATIVO)}
            >
              {m.nome}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
