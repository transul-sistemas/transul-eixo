import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { formatarMes, hojeEmSaoPaulo } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { lerCarteiraDoMes } from "@/lib/dados/acompanhamento";
import { modoDosDados } from "@/lib/dados/fonte";
import {
  enderecoDaCarteira,
  type EstadoDaCarteira,
  FILTROS_DA_CARTEIRA,
  type FiltroDaCarteira,
  lerCarteira,
  mesVizinho,
} from "@/lib/navegacao/acompanhamento";
import { acharTela } from "@/lib/navegacao/catalogo";
import { cn } from "@/lib/utils";
import { ListaDaCarteira } from "./lista-da-carteira";

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

const ROTA = "/frota/carteira";

function cabecalho() {
  const tela = acharTela(ROTA)?.tela;
  return { titulo: tela?.nome ?? "Carteira", descricao: tela?.descricao };
}

const NOMES_DOS_FILTROS: Record<FiltroDaCarteira, string> = {
  todas: "Todas",
  pendentes: "Pendentes",
  conferem: "Conferem",
  nao_conferem: "Não conferem",
};

const classeDoLink =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";

export function PaginaDaCarteiraCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo="Carregando a carteira" />
    </PaginaDeLeitura>
  );
}

function paraParametros(bruto: Record<string, string | string[] | undefined>): URLSearchParams {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(bruto)) {
    const primeiro = Array.isArray(valor) ? valor[0] : valor;
    if (primeiro !== undefined) parametros.set(chave, primeiro);
  }
  return parametros;
}

async function Conteudo({ estado, hoje }: { estado: EstadoDaCarteira; hoje: string }) {
  const carteira = await lerCarteiraDoMes(estado);
  const contagens: Record<FiltroDaCarteira, number> = {
    todas: carteira.total,
    pendentes: carteira.pendentes,
    conferem: carteira.conferem,
    nao_conferem: carteira.naoConferem,
  };
  const mesAtual = hoje.slice(0, 7);
  let lista: ReactNode;
  if (!carteira.gestor) {
    lista = (
      <ListaVazia
        titulo="Você não tem carteira de placas"
        descricao="A confirmação mensal é do gestor de frota: cada gestor confirma as placas da própria carteira. Para ver todas as placas, use a lista de Placas."
      />
    );
  } else if (carteira.filtradas === 0) {
    lista =
      estado.filtro === "todas" ? (
        <ListaVazia
          titulo="Nenhuma placa na sua carteira neste mês"
          descricao="Quando uma placa entrar na sua carteira, ela aparece aqui para você confirmar."
        />
      ) : (
        <ListaVazia
          titulo={`Nenhuma placa em "${NOMES_DOS_FILTROS[estado.filtro]}"`}
          descricao="Tire o filtro para ver a carteira inteira do mês."
          hrefLimpar={enderecoDaCarteira({ ...estado, filtro: "todas", pagina: 1 }, hoje)}
        />
      );
  } else {
    lista = <ListaDaCarteira carteira={carteira} />;
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" aria-label="Mês da carteira">
          <Link
            className={classeDoLink}
            href={enderecoDaCarteira(
              { ...estado, mes: mesVizinho(estado.mes, -1), pagina: 1 },
              hoje,
            )}
          >
            Mês anterior
          </Link>
          <span
            className="min-w-20 text-center font-semibold tabular-nums"
            data-testid="mes-da-carteira"
          >
            {formatarMes(estado.mes)}
          </span>
          {estado.mes < mesAtual ? (
            <Link
              className={classeDoLink}
              href={enderecoDaCarteira(
                { ...estado, mes: mesVizinho(estado.mes, 1), pagina: 1 },
                hoje,
              )}
            >
              Próximo mês
            </Link>
          ) : null}
        </div>
        <nav aria-label="Filtrar a carteira" className="flex flex-wrap gap-2">
          {FILTROS_DA_CARTEIRA.map((f) => (
            <Link
              key={f}
              href={enderecoDaCarteira({ ...estado, filtro: f, pagina: 1 }, hoje)}
              aria-current={estado.filtro === f ? "page" : undefined}
              className={cn(
                classeDoLink,
                estado.filtro === f && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {NOMES_DOS_FILTROS[f]}
              <span className="tabular-nums">{formatarInteiro(contagens[f])}</span>
            </Link>
          ))}
        </nav>
      </div>
      <FaixaDeKpis
        kpis={[
          { id: "total", rotulo: "Placas no mês", valor: formatarInteiro(carteira.total) },
          { id: "conferem", rotulo: "Conferem", valor: formatarInteiro(carteira.conferem) },
          { id: "nao", rotulo: "Não conferem", valor: formatarInteiro(carteira.naoConferem) },
          { id: "pendentes", rotulo: "Pendentes", valor: formatarInteiro(carteira.pendentes) },
        ]}
      />
      {lista}
      {carteira.gestor && carteira.filtradas > 0 ? (
        <nav aria-label="Páginas da carteira" className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground" data-testid="total-da-carteira">
            {formatarInteiro(carteira.filtradas)} placas · página {formatarInteiro(carteira.pagina)}{" "}
            de {formatarInteiro(carteira.paginas)}
          </span>
          {carteira.pagina > 1 ? (
            <Link
              className={classeDoLink}
              href={enderecoDaCarteira({ ...estado, pagina: carteira.pagina - 1 }, hoje)}
            >
              Página anterior
            </Link>
          ) : null}
          {carteira.pagina < carteira.paginas ? (
            <Link
              className={classeDoLink}
              href={enderecoDaCarteira({ ...estado, pagina: carteira.pagina + 1 }, hoje)}
            >
              Próxima página
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

export async function PaginaDaCarteira({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const hoje = hojeEmSaoPaulo(new Date());
  const estado = lerCarteira(paraParametros(await searchParams), hoje);
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      {modoDosDados() !== "banco" ? (
        <ListaVazia
          titulo="A Carteira lê só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para confirmar a carteira do mês."
        />
      ) : (
        <Conteudo estado={estado} hoje={hoje} />
      )}
    </PaginaDeLeitura>
  );
}
