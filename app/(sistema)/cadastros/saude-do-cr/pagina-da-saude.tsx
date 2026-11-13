import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";
import { connection } from "next/server";
import { formatarData, hojeEmSaoPaulo } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { Placa } from "@/components/placa";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import type { ClienteDeEscrita } from "@/lib/dados/escrita-do-banco";
import { fonteDeEscrita, modoDosDados } from "@/lib/dados/fonte";
import {
  type LinhaDoProblema,
  lerProblemaDaSaude,
  lerResumoDaSaudeDoCr,
  type ProblemaDaSaude,
} from "@/lib/dados/saude-do-cr";
import { PROBLEMAS_DA_SAUDE } from "@/lib/dominio/esquemas/dia-cr-e-baixa";
import { acharTela } from "@/lib/navegacao/catalogo";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { cn } from "@/lib/utils";
import { AcoesDaLinha } from "./resolvedores";

// Cadastros › Saúde do CR (CR1, quadro soltas-envio-carteira-e-saude/6): o resumo (cartões) e a lista de
// problemas por tipo, com dono e prazo. Cada linha tem "O que fazer" (os assistentes 25 a 28 em popup),
// "Atribuir dono" (29) e o olho. Os números vêm prontos do banco (resumo_da_saude_do_cr e
// problemas_da_saude_do_cr, paginados lá); nada se soma aqui.

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

const ROTA = "/cadastros/saude-do-cr";
const TAMANHO = 20;

export const NOMES_DOS_PROBLEMAS: Record<ProblemaDaSaude, string> = {
  placa_sem_cr: "Placa sem CR",
  cr_sem_operacao: "CR sem operação",
  dois_do_mesmo_tipo: "Dois CRs do mesmo tipo",
  lancamento_sem_cr: "Lançamento sem CR",
};

const classeDoLink =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";

function cabecalho() {
  const tela = acharTela(ROTA)?.tela;
  return { titulo: tela?.nome ?? "Saúde do CR", descricao: tela?.descricao };
}

export function PaginaDaSaudeCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo="Carregando a saúde do CR" />
    </PaginaDeLeitura>
  );
}

function endereco(problema: ProblemaDaSaude, pagina: number): string {
  const q = new URLSearchParams({ problema });
  if (pagina > 1) q.set("pagina", String(pagina));
  return `${ROTA}?${q.toString()}`;
}

/** O item da linha (placa, CR ou centro) e o detalhe, conforme o problema. */
function itemDaLinha(
  problema: ProblemaDaSaude,
  l: LinhaDoProblema,
): { nome: string; detalhe: string } {
  if (problema === "placa_sem_cr")
    return {
      nome: l.placa ?? "",
      detalhe: [l.tipo, l.gestor, l.operacao].filter(Boolean).join(" · "),
    };
  if (problema === "cr_sem_operacao")
    return { nome: l.codigo ?? "", detalhe: [l.nome, l.tipo_de_cr].filter(Boolean).join(" · ") };
  if (problema === "dois_do_mesmo_tipo")
    return {
      nome: l.placa ?? "",
      detalhe: (l.crs ?? []).map((c) => `${c.codigo} desde ${formatarData(c.inicio)}`).join("; "),
    };
  return {
    nome: `Centro ${String(l.codcencus ?? "")}`,
    detalhe: `${formatarInteiro(l.lancamentos ?? 0)} lançamentos${l.ultima_competencia ? ` · último em ${formatarData(l.ultima_competencia)}` : ""}`,
  };
}

export async function PaginaDaSaude({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const { usuarioId } = await exigirSessao();
  const { titulo, descricao } = cabecalho();
  if (modoDosDados() !== "banco") {
    return (
      <PaginaDeLeitura titulo={titulo} descricao={descricao}>
        <ListaVazia
          titulo="A Saúde do CR lê só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para ver os problemas."
        />
      </PaginaDeLeitura>
    );
  }
  const bruto = await searchParams;
  const pedido = typeof bruto.problema === "string" ? bruto.problema : "";
  const problema: ProblemaDaSaude = (PROBLEMAS_DA_SAUDE as readonly string[]).includes(pedido)
    ? (pedido as ProblemaDaSaude)
    : "placa_sem_cr";
  const numero = Number(typeof bruto.pagina === "string" ? bruto.pagina : "1");
  const pagina = Number.isInteger(numero) && numero >= 1 ? numero : 1;
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeEscrita;
  const hoje = hojeEmSaoPaulo(new Date());
  const [resumo, lista, catalogos] = await Promise.all([
    lerResumoDaSaudeDoCr(cliente),
    lerProblemaDaSaude(cliente, problema, pagina, TAMANHO),
    fonteDeEscrita(hoje).then((f) => f.catalogos()),
  ]);
  const quantidade = (p: ProblemaDaSaude) =>
    resumo.problemas.find((x) => x.problema === p)?.quantidade ?? 0;
  const paginas = Math.max(1, Math.ceil(lista.total / lista.tamanho));
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <FaixaDeKpis
        kpis={[
          { id: "crs", rotulo: "CRs ativos", valor: formatarInteiro(resumo.cartoes.crs_ativos) },
          {
            id: "sem-cr",
            rotulo: "Placas sem CR",
            valor: formatarInteiro(resumo.cartoes.placas_sem_cr),
          },
          {
            id: "sem-operacao",
            rotulo: "CRs sem operação",
            valor: formatarInteiro(resumo.cartoes.crs_sem_operacao),
          },
          {
            id: "dois",
            rotulo: "Placas com dois do mesmo tipo",
            valor: formatarInteiro(resumo.cartoes.placas_com_dois_do_mesmo_tipo),
          },
          {
            id: "centros",
            rotulo: "Centros sem CR",
            valor: formatarInteiro(resumo.cartoes.centros_sem_cr),
          },
        ]}
      />
      <nav aria-label="Tipo de problema" className="flex flex-wrap items-center gap-2">
        {PROBLEMAS_DA_SAUDE.map((p) => (
          <Link
            key={p}
            href={endereco(p, 1)}
            aria-current={p === problema ? "page" : undefined}
            className={cn(
              classeDoLink,
              p === problema && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {NOMES_DOS_PROBLEMAS[p]} ({formatarInteiro(quantidade(p))})
          </Link>
        ))}
      </nav>
      {lista.total === 0 ? (
        <ListaVazia
          titulo={`Nenhum problema de ${NOMES_DOS_PROBLEMAS[problema].toLowerCase()}`}
          descricao="Tudo em ordem neste tipo. Veja os outros tipos acima."
        />
      ) : (
        <ProvedorDoUsuario usuario={usuarioId}>
          <div className="border-border bg-card overflow-x-auto rounded-xl border">
            <table className="w-full text-sm" data-testid="tabela-da-saude-do-cr">
              <caption className="sr-only">{NOMES_DOS_PROBLEMAS[problema]}</caption>
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th
                    scope="col"
                    className="bg-muted sticky left-0 px-3 py-2 text-left font-medium"
                  >
                    Item
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Detalhe
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Dono
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Prazo
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    O que fazer
                  </th>
                  <th scope="col" className="w-14 px-3 py-2 text-right font-medium">
                    Detalhes
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.linhas.map((l, i) => {
                  const item = itemDaLinha(problema, l);
                  return (
                    <tr
                      key={`${item.nome}-${String(i)}`}
                      className="border-border border-t align-top"
                    >
                      <th
                        scope="row"
                        className="bg-card sticky left-0 px-3 py-2 text-left font-medium"
                      >
                        {l.placa ? <Placa placa={l.placa} tamanho="p" /> : item.nome}
                      </th>
                      <td className="text-muted-foreground px-3 py-2">{item.detalhe}</td>
                      <td className="px-3 py-2">{l.dono ?? "Sem dono"}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {l.prazo ? formatarData(l.prazo) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <AcoesDaLinha
                          problema={problema}
                          linha={l}
                          crs={catalogos.crs}
                          operacoes={catalogos.operacoes}
                          pessoas={catalogos.gestores}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <BotaoDoOlho
                          item={item.nome}
                          {...(l.placa ? { hrefDaFicha: `/frota/placas/${l.placa}` } : {})}
                          detalhes={[
                            { rotulo: "Problema", valor: NOMES_DOS_PROBLEMAS[problema] },
                            { rotulo: "Detalhe", valor: item.detalhe || "—" },
                            { rotulo: "Dono", valor: l.dono ?? "Sem dono" },
                            { rotulo: "Prazo", valor: l.prazo ? formatarData(l.prazo) : "—" },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p aria-live="polite">
              {formatarInteiro(lista.total)} problemas · página {formatarInteiro(lista.pagina)} de{" "}
              {formatarInteiro(paginas)}
            </p>
            <nav aria-label="Página dos problemas" className="flex items-center gap-2">
              {lista.pagina > 1 ? (
                <Link
                  href={endereco(problema, lista.pagina - 1)}
                  className={classeDoLink}
                  aria-label="Página anterior"
                >
                  <IconChevronLeft aria-hidden className="size-4" />
                </Link>
              ) : null}
              {lista.pagina < paginas ? (
                <Link
                  href={endereco(problema, lista.pagina + 1)}
                  className={classeDoLink}
                  aria-label="Próxima página"
                >
                  <IconChevronRight aria-hidden className="size-4" />
                </Link>
              ) : null}
            </nav>
          </div>
        </ProvedorDoUsuario>
      )}
    </PaginaDeLeitura>
  );
}
