import { IconAlertCircle, IconAlertTriangle, IconSearchOff } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Etiqueta } from "@/components/etiqueta";
import { formatarData, formatarDataEHora } from "@/components/formato/data";
import { Moeda } from "@/components/formato/moeda";
import { formatarKm } from "@/components/formato/numero";
import { Placa } from "@/components/placa";
import { LinkComContexto } from "@/components/navegacao/link-com-contexto";
import { Button, buttonVariants } from "@/components/ui/button";
import { type DetalheDaPlaca, NOMES_DOS_TIPOS } from "@/lib/dados/placas-tipos";
import { cn } from "@/lib/utils";

const SEM_VALOR = <span className="text-muted-foreground">—</span>;

function Secao({
  titulo,
  grade = false,
  children,
}: {
  titulo: string;
  /** Na ficha as seções são cartões numa grade; no painel, uma pilha com linhas entre elas. */
  grade?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={
        grade
          ? "border-border bg-card rounded-xl border p-4"
          : "border-border border-b py-4 first:pt-0 last:border-b-0"
      }
    >
      <h3 className="mb-2 text-sm font-semibold">{titulo}</h3>
      {children}
    </section>
  );
}

function Campos({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">{children}</dl>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

const textoOuTraco = (valor: string | null) => (valor === null || valor === "" ? SEM_VALOR : valor);

export function haDias(dias: number): string {
  if (dias <= 0) return "hoje";
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

const CLASSE_DA_PLACA_DO_CONJUNTO =
  "focus-visible:ring-ring/50 -m-0.5 inline-flex min-h-6 cursor-pointer items-center rounded p-0.5 outline-none focus-visible:ring-3";

/** Uma placa do conjunto: no painel é um botão que troca o painel; na ficha, um link para a ficha dela. */
function PlacaDoConjunto({
  placa,
  aoEspiar,
  hrefDaPlaca,
}: {
  placa: string;
  aoEspiar?: (placa: string) => void;
  hrefDaPlaca?: (placa: string) => string;
}) {
  if (hrefDaPlaca) {
    return (
      <LinkComContexto
        href={hrefDaPlaca(placa)}
        aria-label={`Abrir ficha de ${placa}`}
        className={CLASSE_DA_PLACA_DO_CONJUNTO}
      >
        <Placa placa={placa} tamanho="m" />
      </LinkComContexto>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Espiar ${placa}`}
      onClick={() => aoEspiar?.(placa)}
      className={CLASSE_DA_PLACA_DO_CONJUNTO}
    >
      <Placa placa={placa} tamanho="m" />
    </button>
  );
}

function Conjunto({
  detalhe,
  aoEspiar,
  hrefDaPlaca,
}: {
  detalhe: DetalheDaPlaca;
  aoEspiar?: (placa: string) => void;
  hrefDaPlaca?: (placa: string) => string;
}) {
  const { cavalo, implementos } = detalhe.conjunto;
  if (!cavalo && implementos.length === 0) {
    return <p className="text-muted-foreground text-sm">Sem conjunto</p>;
  }
  return (
    <Campos>
      {cavalo ? (
        <Campo rotulo="Cavalo">
          <PlacaDoConjunto placa={cavalo} aoEspiar={aoEspiar} hrefDaPlaca={hrefDaPlaca} />
        </Campo>
      ) : null}
      {implementos.length > 0 ? (
        <Campo rotulo={implementos.length === 1 ? "Implemento" : "Implementos"}>
          <ul className="flex flex-wrap gap-2">
            {implementos.map((placa) => (
              <li key={placa}>
                <PlacaDoConjunto placa={placa} aoEspiar={aoEspiar} hrefDaPlaca={hrefDaPlaca} />
              </li>
            ))}
          </ul>
        </Campo>
      ) : null}
    </Campos>
  );
}

/**
 * As cinco seções do resumo (situação, conjunto, gestão, alertas e dados), usadas pelo painel de
 * espiar (em pilha) e pela ficha (em grade). No painel as placas do conjunto trocam o painel
 * (`aoEspiar`); na ficha levam à ficha delas (`hrefDaPlaca`).
 */
export function SecoesDoResumo({
  detalhe,
  aoEspiar,
  hrefDaPlaca,
  disposicao = "pilha",
}: {
  detalhe: DetalheDaPlaca;
  aoEspiar?: (placa: string) => void;
  hrefDaPlaca?: (placa: string) => string;
  disposicao?: "pilha" | "grade";
}) {
  const crlvVencido = detalhe.alertas.some((alerta) => alerta.codigo === "crlv-vencido");
  const grade = disposicao === "grade";
  return (
    <div className={grade ? "grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" : undefined}>
      <Secao titulo="Situação" grade={grade}>
        <Etiqueta status={detalhe.grupo} titulo={detalhe.nomeDaSituacao}>
          <span className="font-semibold">{detalhe.sigla}</span>
          <span>{detalhe.nomeDaSituacao}</span>
        </Etiqueta>
        <p className="text-muted-foreground mt-2 text-sm">
          {haDias(detalhe.diasNoStatus)}, desde {formatarDataEHora(detalhe.desde)}
        </p>
      </Secao>

      <Secao titulo="Conjunto" grade={grade}>
        <Conjunto detalhe={detalhe} aoEspiar={aoEspiar} hrefDaPlaca={hrefDaPlaca} />
      </Secao>

      <Secao titulo="Gestão" grade={grade}>
        <Campos>
          <Campo rotulo="Gestor">{detalhe.gestor}</Campo>
          <Campo rotulo="Operação">{textoOuTraco(detalhe.operacao)}</Campo>
          <Campo rotulo="CR vigente">
            {detalhe.crsVigentes.length === 0 ? (
              SEM_VALOR
            ) : (
              <ul>
                {detalhe.crsVigentes.map((cr) => (
                  <li key={cr.codigo}>
                    <span className="tabular-nums">{cr.codigo}</span>, {cr.nome}
                  </li>
                ))}
              </ul>
            )}
          </Campo>
        </Campos>
      </Secao>

      <Secao titulo="Alertas" grade={grade}>
        {detalhe.alertas.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sem alertas</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {detalhe.alertas.map((alerta) => (
              <li key={alerta.codigo} className="flex items-start gap-2">
                <IconAlertTriangle
                  aria-hidden
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                />
                <span>{alerta.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Dados" grade={grade}>
        <Campos>
          <Campo rotulo="Motorista">{textoOuTraco(detalhe.motorista)}</Campo>
          <Campo rotulo="Filial">{detalhe.filial}</Campo>
          <Campo rotulo="CRLV vence em">
            {detalhe.crlvVenceEm === null ? (
              SEM_VALOR
            ) : (
              <>
                {formatarData(detalhe.crlvVenceEm)}
                {crlvVencido ? <span className="text-texto-negativo"> (vencido)</span> : null}
              </>
            )}
          </Campo>
          <Campo rotulo="KM">
            <span className="tabular-nums">{formatarKm(detalhe.km)}</span>
          </Campo>
          <Campo rotulo="Valor FIPE">
            <Moeda valor={detalhe.valorFipeCentavos} />
          </Campo>
          <Campo rotulo="RENAVAM">
            <span className="tabular-nums">{detalhe.renavam}</span>
          </Campo>
        </Campos>
      </Secao>
    </div>
  );
}

/** O resumo da placa no painel de espiar: o modelo, o tipo e o ano, e as cinco seções em pilha. */
export function ResumoDaPlaca({
  detalhe,
  aoEspiar,
}: {
  detalhe: DetalheDaPlaca;
  /** Troca o painel para outra placa (as do conjunto). */
  aoEspiar: (placa: string) => void;
}) {
  return (
    <div>
      <div className="border-border mb-4 border-b pb-4">
        <p className="text-base font-semibold">{detalhe.modelo}</p>
        <p className="text-muted-foreground text-sm">
          {NOMES_DOS_TIPOS[detalhe.tipo]}
          {detalhe.ano !== null ? `, ano ${detalhe.ano}` : ""}
        </p>
      </div>
      <SecoesDoResumo detalhe={detalhe} aoEspiar={aoEspiar} />
    </div>
  );
}

/** O rodapé fixo do painel: leva à ficha completa da placa (o Voltar da ficha devolve ao painel). */
export function BotaoDaFicha({ placa }: { placa: string }) {
  return (
    <div className="border-border shrink-0 border-t p-4">
      <LinkComContexto
        href={`/frota/placas/${placa}`}
        className={cn(buttonVariants({ variant: "outline" }), "min-h-8 w-full")}
      >
        Abrir ficha completa
      </LinkComContexto>
    </div>
  );
}

/** Enquanto o resumo chega: o mesmo esqueleto de seções, para o painel não pular. */
export function ResumoCarregando() {
  return (
    <div role="status" aria-label="Carregando o resumo">
      <span className="sr-only">Carregando o resumo…</span>
      <div aria-hidden className="space-y-6">
        <div className="space-y-2">
          <span className="bg-muted block h-5 w-40 animate-pulse rounded" />
          <span className="bg-muted block h-4 w-24 animate-pulse rounded" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <span className="bg-muted block h-4 w-20 animate-pulse rounded" />
            <span className="bg-muted block h-5 w-48 animate-pulse rounded-full" />
            <span className="bg-muted block h-4 w-56 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placa bem escrita que não existe: diz o que houve e o que conferir. */
export function PlacaNaoEncontrada({ placa }: { placa: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-8 text-center">
      <IconSearchOff aria-hidden className="text-muted-foreground size-8" />
      <h3 className="text-base font-semibold">Placa não encontrada</h3>
      <p className="text-muted-foreground max-w-[40ch] text-sm">
        Não há cadastro para a placa {placa}. Confira se ela está escrita certa no endereço ou
        busque pela lista. Feche o painel para voltar a ela.
      </p>
    </div>
  );
}

/** O painel falhou, a lista não: oferece tentar de novo. */
export function ErroDoResumo({ aoTentar, pendente }: { aoTentar: () => void; pendente: boolean }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
      <IconAlertCircle aria-hidden className="text-texto-negativo size-8" />
      <h3 className="text-base font-semibold">Não foi possível carregar o resumo</h3>
      <p className="text-muted-foreground max-w-[40ch] text-sm">
        O resumo desta placa não respondeu. A lista continua funcionando. Tente de novo; se
        continuar, avise quem cuida do sistema.
      </p>
      <Button type="button" variant="outline" onClick={aoTentar} disabled={pendente}>
        Tentar de novo
      </Button>
    </div>
  );
}
