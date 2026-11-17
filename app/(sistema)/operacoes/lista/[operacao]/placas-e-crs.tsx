import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { Etiqueta } from "@/components/etiqueta";
import { formatarData } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { Placa } from "@/components/placa";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import type { ClienteDeEscrita } from "@/lib/dados/escrita-do-banco";
import { modoDosDados } from "@/lib/dados/fonte";
import { lerPlacasECrsDaOperacao, type PlacasECrsDaOperacao } from "@/lib/dados/vinculos-de-cr";
import { textoDoErro } from "@/lib/log/erro";

// Operações › ficha › aba Placas: "Placas e CRs com história" (V0, quadro tarefas-e-vinculos/3). Cada
// placa e cada CR que passou pela operação, com a vigência: vigente em verde e encerrado em vermelho suave,
// sempre com rótulo, data e ícone (nucleo.placas_e_crs_da_operacao com o histórico).

function Vigencia({ inicio, fim, vigente }: { inicio: string; fim: string | null; vigente: boolean }) {
  return vigente ? (
    <Etiqueta status="em-atividade">
      <IconCircleCheck aria-hidden className="size-3.5" />
      Vigente desde {formatarData(inicio)}
    </Etiqueta>
  ) : (
    <Etiqueta status="impedida">
      <IconCircleX aria-hidden className="size-3.5" />
      Encerrado em {fim ? formatarData(fim) : "—"}
    </Etiqueta>
  );
}

export async function PlacasECrsComHistoria({ operacaoId }: { operacaoId: string }) {
  if (modoDosDados() !== "banco") {
    return (
      <p className="text-muted-foreground text-sm">
        Sem dados ainda: a história de placas e CRs depende do banco.
      </p>
    );
  }
  let dados: PlacasECrsDaOperacao;
  try {
    const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeEscrita;
    dados = await lerPlacasECrsDaOperacao(cliente, operacaoId, true);
  } catch (erro) {
    console.error("placas e CRs da operação indisponíveis:", textoDoErro(erro));
    return (
      <p role="alert" className="text-sm">
        Não foi possível ler a história de placas e CRs. Recarregue a página para tentar de novo.
      </p>
    );
  }
  return (
    <section aria-label="Placas e CRs com história" className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">Placas e CRs com história</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border-border bg-card overflow-x-auto rounded-xl border">
          <table className="w-full text-sm" data-testid="placas-com-historia">
            <caption className="text-muted-foreground px-3 py-2 text-left text-xs">
              {formatarInteiro(dados.placas.length)} vínculos de placa
            </caption>
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Placa</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Vigência</th>
                <th scope="col" className="w-14 px-3 py-2 text-right font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {dados.placas.map((p, i) => (
                <tr key={`${p.ativo_id}-${p.inicio}-${String(i)}`} className="border-border border-t">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {p.placa ? <Placa placa={p.placa} tamanho="p" /> : "—"}
                  </th>
                  <td className="px-3 py-2">
                    <Vigencia inicio={p.inicio} fim={p.fim} vigente={p.vigente} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <BotaoDoOlho
                      item={p.placa ?? "placa"}
                      {...(p.placa ? { hrefDaFicha: `/frota/placas/${p.placa}` } : {})}
                      detalhes={[
                        { rotulo: "Tipo", valor: p.tipo ?? "—" },
                        { rotulo: "Início", valor: formatarData(p.inicio) },
                        { rotulo: "Fim", valor: p.fim ? formatarData(p.fim) : "Vigente" },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-border bg-card overflow-x-auto rounded-xl border">
          <table className="w-full text-sm" data-testid="crs-com-historia">
            <caption className="text-muted-foreground px-3 py-2 text-left text-xs">
              {formatarInteiro(dados.crs.length)} vínculos de CR
            </caption>
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">CR</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Vigência</th>
                <th scope="col" className="w-14 px-3 py-2 text-right font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {dados.crs.map((c, i) => (
                <tr key={`${c.cr_id}-${c.inicio}-${String(i)}`} className="border-border border-t">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {c.codigo}
                    <span className="text-muted-foreground block text-xs font-normal">
                      {[c.nome, c.tipo].filter(Boolean).join(" · ")}
                    </span>
                  </th>
                  <td className="px-3 py-2">
                    <Vigencia inicio={c.inicio} fim={c.fim} vigente={c.vigente} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <BotaoDoOlho
                      item={`CR ${c.codigo}`}
                      detalhes={[
                        { rotulo: "Nome", valor: c.nome ?? "—" },
                        { rotulo: "Tipo", valor: c.tipo },
                        { rotulo: "Início", valor: formatarData(c.inicio) },
                        { rotulo: "Fim", valor: c.fim ? formatarData(c.fim) : "Vigente" },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
