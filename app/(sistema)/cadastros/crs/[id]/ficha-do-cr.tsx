import { IconCircleCheck, IconCircleX, IconLock } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Etiqueta } from "@/components/etiqueta";
import { formatarData } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { Placa } from "@/components/placa";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import type { ClienteDeEscrita } from "@/lib/dados/escrita-do-banco";
import { modoDosDados } from "@/lib/dados/fonte";
import { type HistoriaDoCr, lerHistoriaDoCr } from "@/lib/dados/vinculos-de-cr";
import { textoDoErro } from "@/lib/log/erro";

// Cadastros › Ficha do CR (Nível 3; docs/fichas-de-tela/cadastros-ficha-do-cr.md), primeira versão: o
// cabeçalho do CR e a linha do tempo em duas trilhas, as placas que ele atendeu e as operações a que
// pertenceu, vigente em verde e encerrado em vermelho suave, sempre com rótulo, data e ícone. Lê
// nucleo.historia_do_cr (N1) com a sessão de quem usa. Despesa e receita ficam para a ponte do Sankhya.

function Vigencia({
  inicio,
  fim,
  vigente,
}: {
  inicio: string | null;
  fim: string | null;
  vigente: boolean;
}) {
  return vigente ? (
    <Etiqueta status="em-atividade">
      <IconCircleCheck aria-hidden className="size-3.5" />
      {inicio ? `Vigente desde ${formatarData(inicio)}` : "Vigente"}
    </Etiqueta>
  ) : (
    <Etiqueta status="impedida">
      <IconCircleX aria-hidden className="size-3.5" />
      Encerrado em {fim ? formatarData(fim) : "data não informada"}
    </Etiqueta>
  );
}

const TH = "px-3 py-2 text-left font-medium";
const CARTAO = "border-border bg-card rounded-xl border px-3 py-2";

export function FichaDoCrCarregando() {
  return (
    <PaginaDeLeitura
      titulo="CR"
      descricao="O centro de resultado, com as placas e as operações que teve."
    >
      <EsqueletoDaTabela linhas={6} rotulo="Carregando o CR" />
    </PaginaDeLeitura>
  );
}

export async function FichaDoCr({ id }: { id: string }) {
  if (modoDosDados() !== "banco") {
    return (
      <PaginaDeLeitura titulo="CR">
        <ListaVazia
          titulo="A ficha do CR lê só do banco"
          descricao="Esta tela não tem dados de exemplo. Rode o sistema com os dados do banco para ver a história do CR."
        />
      </PaginaDeLeitura>
    );
  }
  let dados: HistoriaDoCr;
  try {
    const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeEscrita;
    dados = await lerHistoriaDoCr(cliente, id);
  } catch (erro) {
    console.error("ficha do CR indisponível:", textoDoErro(erro));
    return (
      <PaginaDeLeitura titulo="CR">
        <p role="alert" className="text-sm">
          Não foi possível carregar o CR. Recarregue a página para tentar de novo.
        </p>
      </PaginaDeLeitura>
    );
  }
  const cr = dados.cr;
  if (!cr) notFound();
  const semNada = dados.placas.length === 0 && dados.operacoes.length === 0;
  return (
    <PaginaDeLeitura
      titulo={`CR ${cr.codigo}`}
      descricao={cr.nome ?? undefined}
      acoes={
        <Link
          href="/cadastros/crs"
          className="border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
        >
          Voltar aos CRs
        </Link>
      }
    >
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-3 text-sm">
        <div className={CARTAO}>
          <dt className="text-muted-foreground">Código do Sankhya</dt>
          <dd className="font-medium tabular-nums">
            {cr.codcencus !== null ? formatarInteiro(cr.codcencus) : "sem código do Sankhya"}
          </dd>
        </div>
        <div className={CARTAO}>
          <dt className="text-muted-foreground">Tipo</dt>
          <dd className="font-medium">{cr.tipo}</dd>
        </div>
        <div className={CARTAO}>
          <dt className="text-muted-foreground">Situação no Sankhya</dt>
          <dd className="font-medium">
            {cr.bloqueado || !cr.ativo ? (
              <Etiqueta status="impedida">
                <IconLock aria-hidden className="size-3.5" />
                {cr.bloqueado ? "Bloqueado" : "Inativo"} (continua recebendo despesa)
              </Etiqueta>
            ) : (
              <Etiqueta status="em-atividade">
                <IconCircleCheck aria-hidden className="size-3.5" />
                Ativo
              </Etiqueta>
            )}
          </dd>
        </div>
        <div className={CARTAO}>
          <dt className="text-muted-foreground">Despesa e receita</dt>
          <dd className="text-muted-foreground">Sem dados ainda: depende da ponte do Sankhya</dd>
        </div>
      </dl>

      {semNada ? (
        <ListaVazia
          titulo="Este CR ainda não tem placa nem operação"
          descricao="Despesas que chegarem para ele ficam em sem destino até o vínculo existir. Resolva pela Saúde do CR."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-label="Placas que o CR atendeu" className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">Placas</h2>
            <div className="border-border bg-card overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <caption className="text-muted-foreground px-3 py-2 text-left text-xs">
                  {formatarInteiro(dados.placas.length)} vínculos de placa
                </caption>
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th scope="col" className={TH}>
                      Placa
                    </th>
                    <th scope="col" className={TH}>
                      Vigência
                    </th>
                    <th scope="col" className="w-14 px-3 py-2 text-right font-medium">
                      Detalhes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dados.placas.map((p) => (
                    <tr key={p.vinculo_id} className="border-border border-t">
                      <th scope="row" className="px-3 py-2 text-left font-normal">
                        {p.placa ? (
                          <Link
                            href={`/frota/placas/${p.placa}`}
                            aria-label={`Abrir a ficha da placa ${p.placa}`}
                            className="focus-visible:ring-ring/50 inline-flex rounded outline-none focus-visible:ring-3"
                          >
                            <Placa placa={p.placa} tamanho="p" />
                          </Link>
                        ) : (
                          "placa sem registro"
                        )}
                      </th>
                      <td className="px-3 py-2">
                        <Vigencia inicio={p.inicio} fim={p.fim} vigente={p.vigente} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <BotaoDoOlho
                          item={p.placa ?? "placa"}
                          {...(p.placa ? { hrefDaFicha: `/frota/placas/${p.placa}` } : {})}
                          detalhes={[
                            { rotulo: "Início", valor: formatarData(p.inicio) },
                            { rotulo: "Fim", valor: p.fim ? formatarData(p.fim) : "vigente" },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section aria-label="Operações a que o CR pertenceu" className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">Operações</h2>
            <div className="border-border bg-card overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <caption className="text-muted-foreground px-3 py-2 text-left text-xs">
                  {formatarInteiro(dados.operacoes.length)} vínculos de operação
                </caption>
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th scope="col" className={TH}>
                      Operação
                    </th>
                    <th scope="col" className={TH}>
                      Vigência
                    </th>
                    <th scope="col" className={TH}>
                      Origem
                    </th>
                    <th scope="col" className="w-14 px-3 py-2 text-right font-medium">
                      Detalhes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dados.operacoes.map((o, i) => (
                    <tr
                      key={`${o.operacao_id}-${o.inicio ?? "cadastro"}-${String(i)}`}
                      className="border-border border-t"
                    >
                      <th scope="row" className="px-3 py-2 text-left font-normal">
                        <Link
                          href={`/operacoes/lista/${o.operacao_id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {o.operacao}
                        </Link>
                      </th>
                      <td className="px-3 py-2">
                        <Vigencia inicio={o.inicio} fim={o.fim} vigente={o.vigente} />
                      </td>
                      <td className="text-muted-foreground px-3 py-2">
                        {o.origem === "vinculo" ? "Vínculo com vigência" : "Cadastro do CR"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <BotaoDoOlho
                          item={o.operacao}
                          hrefDaFicha={`/operacoes/lista/${o.operacao_id}`}
                          detalhes={[
                            {
                              rotulo: "Início",
                              valor: o.inicio ? formatarData(o.inicio) : "do cadastro",
                            },
                            { rotulo: "Fim", valor: o.fim ? formatarData(o.fim) : "vigente" },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      <p className="text-muted-foreground text-sm">
        Algo errado com este CR?{" "}
        <Link href="/cadastros/saude-do-cr" className="underline underline-offset-2">
          Abrir a Saúde do CR
        </Link>
        .
      </p>
    </PaginaDeLeitura>
  );
}
