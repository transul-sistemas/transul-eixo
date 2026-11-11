import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";
import { connection } from "next/server";
import { formatarData, hojeEmSaoPaulo } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { Placa } from "@/components/placa";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { modoDosDados } from "@/lib/dados/fonte";
import { type ExcecoesAbertas, lerExcecoes, type LinhaDeExcecao } from "@/lib/dados/tarefas";
import { enderecoDaFila, nomeDoAssunto, ROTA_DA_FILA } from "@/lib/dominio/tarefas";
import { acharTela } from "@/lib/navegacao/catalogo";
import { type EstadoDaFila, lerFila } from "@/lib/navegacao/excecoes";
import { cn } from "@/lib/utils";
import { AssistentesDaFrota } from "../placas/assistentes/assistentes-da-frota";
import { carregarDadosDosAssistentes } from "../placas/assistentes/carregar-dados";

// Frota › Exceções (primeira versão): a fila do que o cadastro não resolveu sozinho. Quem enxerga o quê é
// o banco (RLS): o Administrador e a Diretoria veem a fila inteira; o Gestor de frota, só as placas da
// sua carteira. "Completar dado" abre o assistente Corrigir placa (RENAVAM, número de série, eixos e
// carroceria), que grava pelas funções atômicas de sempre; completo o cadastro, a exceção sai da fila.

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

function cabecalho() {
  const tela = acharTela(ROTA_DA_FILA)?.tela;
  return { titulo: tela?.nome ?? "Exceções", descricao: tela?.descricao };
}

function paraParametros(bruto: Record<string, string | string[] | undefined>): URLSearchParams {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(bruto)) {
    const primeiro = Array.isArray(valor) ? valor[0] : valor;
    if (primeiro !== undefined) parametros.set(chave, primeiro);
  }
  return parametros;
}

const classeDoLink =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";
const celula = "px-3 py-2";

export function PaginaDaFilaCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo="Carregando as exceções" />
    </PaginaDeLeitura>
  );
}

function Tipos({ fila, estado }: { fila: ExcecoesAbertas; estado: EstadoDaFila }) {
  const todas = fila.tipos.reduce((soma, t) => soma + t.n, 0);
  return (
    <nav aria-label="Tipo de exceção" className="flex flex-wrap items-center gap-2">
      <Link
        href={enderecoDaFila({ assunto: null, pagina: 1 })}
        aria-current={estado.assunto === null ? "page" : undefined}
        className={cn(
          classeDoLink,
          estado.assunto === null && "bg-primary text-primary-foreground hover:bg-primary",
        )}
      >
        Todas ({formatarInteiro(todas)})
      </Link>
      {fila.tipos.map((t) => (
        <Link
          key={t.assunto}
          href={enderecoDaFila({ assunto: t.assunto, pagina: 1 })}
          aria-current={estado.assunto === t.assunto ? "page" : undefined}
          className={cn(
            classeDoLink,
            estado.assunto === t.assunto && "bg-primary text-primary-foreground hover:bg-primary",
          )}
        >
          {nomeDoAssunto(t.assunto)} ({formatarInteiro(t.n)})
        </Link>
      ))}
    </nav>
  );
}

function enderecoDoAssistente(estado: EstadoDaFila, placa: string): string {
  const base = enderecoDaFila(estado);
  const separador = base.includes("?") ? "&" : "?";
  return `${base}${separador}assistente=corrigir-placa&placa=${encodeURIComponent(placa)}`;
}

function Linha({ l, estado }: { l: LinhaDeExcecao; estado: EstadoDaFila }) {
  return (
    <tr className="border-border border-t align-top">
      <th scope="row" className={cn(celula, "bg-card sticky left-0 text-left font-medium")}>
        {l.placa !== null ? (
          <Placa placa={l.placa} tamanho="p" />
        ) : (
          (l.pessoaNome ?? (l.cr !== null ? `CR ${l.cr}` : "—"))
        )}
      </th>
      <td className={celula}>{nomeDoAssunto(l.assunto)}</td>
      <td className={cn(celula, "text-muted-foreground max-w-[60ch]")}>{l.descricao}</td>
      <td className={cn(celula, "tabular-nums")}>{formatarData(l.criadoEm)}</td>
      <td className={cn(celula, "text-right")}>
        {l.assunto === "cadastro_incompleto" && l.placa !== null ? (
          <Link
            href={enderecoDoAssistente(estado, l.placa)}
            scroll={false}
            aria-label={`Completar dado da placa ${l.placa}`}
            className={classeDoLink}
          >
            Completar dado
          </Link>
        ) : (
          <span className="text-muted-foreground text-sm">Sem ação nesta tela</span>
        )}
      </td>
    </tr>
  );
}

function Paginacao({ fila, estado }: { fila: ExcecoesAbertas; estado: EstadoDaFila }) {
  const paginas = Math.max(1, Math.ceil(fila.total / fila.tamanho));
  const primeiro = fila.total === 0 ? 0 : (fila.pagina - 1) * fila.tamanho + 1;
  const ultimo = Math.min(fila.pagina * fila.tamanho, fila.total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p aria-live="polite">
        Mostrando {formatarInteiro(primeiro)}–{formatarInteiro(ultimo)} de{" "}
        {formatarInteiro(fila.total)} exceções
      </p>
      <nav aria-label="Página das exceções" className="flex items-center gap-2">
        {fila.pagina > 1 ? (
          <Link
            href={enderecoDaFila({ ...estado, pagina: fila.pagina - 1 })}
            className={classeDoLink}
            aria-label="Página anterior"
          >
            <IconChevronLeft aria-hidden className="size-4" />
          </Link>
        ) : null}
        <span className="tabular-nums">
          Página {formatarInteiro(fila.pagina)} de {formatarInteiro(paginas)}
        </span>
        {fila.pagina < paginas ? (
          <Link
            href={enderecoDaFila({ ...estado, pagina: fila.pagina + 1 })}
            className={classeDoLink}
            aria-label="Próxima página"
          >
            <IconChevronRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

async function Conteudo({ parametros }: { parametros: URLSearchParams }) {
  const estado = lerFila(parametros);
  const hoje = hojeEmSaoPaulo(new Date());
  const [fila, dadosDosAssistentes] = await Promise.all([
    lerExcecoes(estado),
    carregarDadosDosAssistentes({
      assistente: parametros.get("assistente"),
      placa: parametros.get("placa"),
      hoje,
    }),
  ]);
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura
      titulo={titulo}
      descricao={descricao}
      acoes={dadosDosAssistentes ? <AssistentesDaFrota dados={dadosDosAssistentes} /> : undefined}
    >
      {fila.tipos.length > 0 ? <Tipos fila={fila} estado={estado} /> : null}
      {fila.total === 0 ? (
        <ListaVazia
          titulo={estado.assunto ? "Nenhuma exceção deste tipo" : "Nenhuma exceção em aberto"}
          descricao={
            estado.assunto
              ? "Escolha outro tipo, ou veja todas as exceções."
              : "Quando o cadastro deixar um dado a completar, a exceção aparece aqui para você resolver."
          }
          {...(estado.assunto ? { hrefLimpar: ROTA_DA_FILA } : {})}
        />
      ) : (
        <>
          <div className="border-border bg-card overflow-x-auto rounded-xl border">
            <table className="w-full text-sm" data-testid="tabela-de-excecoes">
              <caption className="sr-only">Exceções em aberto</caption>
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th
                    scope="col"
                    className={cn(celula, "sticky left-0 bg-inherit text-left font-medium")}
                  >
                    Placa ou pessoa
                  </th>
                  <th scope="col" className={cn(celula, "text-left font-medium")}>
                    Tipo
                  </th>
                  <th scope="col" className={cn(celula, "text-left font-medium")}>
                    O que falta
                  </th>
                  <th scope="col" className={cn(celula, "text-left font-medium")}>
                    Desde
                  </th>
                  <th scope="col" className={cn(celula, "text-right font-medium")}>
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {fila.linhas.map((l) => (
                  <Linha key={l.id} l={l} estado={estado} />
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao fila={fila} estado={estado} />
        </>
      )}
    </PaginaDeLeitura>
  );
}

export async function PaginaDaFila({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const parametros = paraParametros(await searchParams);
  if (modoDosDados() !== "banco") {
    const { titulo, descricao } = cabecalho();
    return (
      <PaginaDeLeitura titulo={titulo} descricao={descricao}>
        <ListaVazia
          titulo="As Exceções leem só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para ver a fila."
        />
      </PaginaDeLeitura>
    );
  }
  return <Conteudo parametros={parametros} />;
}
