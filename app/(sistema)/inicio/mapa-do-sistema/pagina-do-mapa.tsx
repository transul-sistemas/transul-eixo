import Link from "next/link";
import { formatarInteiro } from "@/components/formato/numero";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { CelulaDaGrade, GradeDePaineis } from "@/components/layout/grade-de-paineis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { IconeDoCatalogo } from "@/components/navegacao/icones";
import { acharTela } from "@/lib/navegacao/catalogo";
import {
  type FiltroDoMapa,
  montarMapa,
  NOMES_DOS_ESTADOS,
  ROTA_DO_MAPA,
} from "@/lib/navegacao/mapa-do-sistema";
import type { Perfil } from "@/lib/navegacao/perfis";
import { cn } from "@/lib/utils";

const FILTROS: readonly { id: FiltroDoMapa; nome: string }[] = [
  { id: "todos", nome: "Todas" },
  { id: "pronto", nome: "Prontas" },
  { id: "esqueleto", nome: "Estrutura" },
];

const classeDoChip =
  "focus-visible:ring-ring/50 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";

/**
 * O índice vivo do sistema: módulos e telas com o estado, o link e os perfis que veem cada tela.
 * Tudo vem do catálogo (`lib/navegacao/catalogo.ts`); a pessoa vê só o que o perfil dela abre.
 */
export function PaginaDoMapa({ perfil, filtro }: { perfil: Perfil; filtro: FiltroDoMapa }) {
  const mapa = montarMapa(perfil, filtro);
  const tela = acharTela(ROTA_DO_MAPA)?.tela;
  const filtrosComTela = FILTROS.filter((f) => f.id === "todos" || mapa.contagem[f.id] > 0);
  return (
    <PaginaDeLeitura
      titulo={tela?.nome ?? "Mapa do sistema"}
      descricao={tela?.descricao}
      consulta={
        <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
          {filtrosComTela.map((f) => {
            const ativo = f.id === filtro;
            return (
              <Link
                key={f.id}
                href={f.id === "todos" ? ROTA_DO_MAPA : `${ROTA_DO_MAPA}?estado=${f.id}`}
                aria-current={ativo ? "true" : undefined}
                className={cn(
                  classeDoChip,
                  ativo
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-input bg-card hover:bg-muted",
                )}
              >
                {f.nome}
                <span className="text-muted-foreground tabular-nums">
                  {formatarInteiro(mapa.contagem[f.id])}
                </span>
              </Link>
            );
          })}
        </nav>
      }
      kpis={
        <FaixaDeKpis
          kpis={[
            {
              id: "telas",
              rotulo: "Telas que você vê",
              valor: formatarInteiro(mapa.contagem.todos),
            },
            { id: "prontas", rotulo: "Prontas", valor: formatarInteiro(mapa.contagem.pronto) },
            {
              id: "estrutura",
              rotulo: "Só estrutura",
              valor: formatarInteiro(mapa.contagem.esqueleto),
              apoio: "Abrem inteiras, ainda sem dados",
            },
            { id: "modulos", rotulo: "Módulos", valor: formatarInteiro(mapa.modulos.length) },
          ]}
        />
      }
    >
      <GradeDePaineis>
        {mapa.modulos.map(({ modulo, telas }) => (
          <CelulaDaGrade key={modulo.id} colunas={4}>
            <section
              aria-label={modulo.nome}
              data-modulo={modulo.id}
              className="border-border bg-card flex h-full min-w-0 flex-col gap-3 rounded-xl border p-4"
            >
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <IconeDoCatalogo nome={modulo.icone} className="size-5" />
                {modulo.nome}
              </h2>
              <ul className="flex flex-col gap-3">
                {telas.map(({ tela: t, perfisQueVeem }) => (
                  <li key={t.id} data-tela={t.id} className="flex flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={t.rota}
                        className="focus-visible:ring-ring/50 font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3"
                      >
                        {t.nome}
                      </Link>
                      {/* Neutra de propósito: cor de status é da placa, não da tela. */}
                      <span
                        data-estado={t.estado}
                        className={cn(
                          "rounded border px-1.5 text-xs leading-5",
                          t.estado === "pronto"
                            ? "border-primary/40 text-foreground"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {NOMES_DOS_ESTADOS[t.estado]}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">{t.descricao}</p>
                    <p className="text-muted-foreground text-xs">
                      Quem vê: {perfisQueVeem.join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </CelulaDaGrade>
        ))}
      </GradeDePaineis>
    </PaginaDeLeitura>
  );
}
