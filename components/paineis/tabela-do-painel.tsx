import { PaginasDaLista } from "@/app/(sistema)/operacional/navegacao-da-lista";
import { FORMATOS_A_DIREITA, ValorFormatado } from "@/components/formato/valor";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import { ListaVazia } from "@/components/tabela/estados";
import Link from "next/link";
import type { AcaoDaLinha, TabelaDoPainel as Tabela } from "@/lib/dados/painel-tipos";
import { cn } from "@/lib/utils";

// A tabela da tela de painel: cabeçalho e primeira coluna fixos, rolagem lateral só dentro da caixa, o
// olho como último botão de toda linha (painel lateral com o detalhe e "Abrir a ficha") e a paginação no
// servidor (total sempre visível e respeitando o filtro; 20, 50 ou 100 por página, lembrado).

export function TabelaDoPainel({
  tabela,
  enderecoDaPagina,
  enderecoDoTamanho,
  hrefLimpar,
  enderecoDaAcao,
}: {
  tabela: Tabela;
  /** O endereço que abre o assistente da ação da linha, ou nulo quando o perfil não pode usá-la. */
  enderecoDaAcao?: (acao: AcaoDaLinha) => string | null;
  enderecoDaPagina: (pagina: number) => string;
  enderecoDoTamanho: (tam: number) => string;
  /** Com filtro ou busca, o endereço sem eles. */
  hrefLimpar?: string;
}) {
  if (tabela.total === 0) {
    return (
      <section aria-label={tabela.titulo} className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{tabela.titulo}</h2>
        <ListaVazia
          titulo={hrefLimpar ? "Nada combina com o filtro" : "Nada a mostrar ainda"}
          descricao={
            hrefLimpar
              ? "Nenhuma linha combina com o filtro e a busca. Limpe os filtros para ver tudo."
              : "Quando houver dados neste período, as linhas aparecem aqui."
          }
          {...(hrefLimpar ? { hrefLimpar } : {})}
        />
      </section>
    );
  }
  const direita = (formato: Tabela["colunas"][number]["formato"]) =>
    FORMATOS_A_DIREITA.includes(formato);
  const acoesDe = (l: Tabela["linhas"][number]) =>
    (l.acoes ?? [])
      .map((a) => ({ a, href: enderecoDaAcao?.(a) ?? null }))
      .filter((x): x is { a: AcaoDaLinha; href: string } => x.href !== null);
  const comAcoes = tabela.linhas.some((l) => acoesDe(l).length > 0);
  return (
    <section aria-label={tabela.titulo} className="flex min-w-0 flex-col gap-2">
      <h2 className="text-lg font-semibold">{tabela.titulo}</h2>
      <div
        role="region"
        aria-label={`${tabela.titulo}, rolagem`}
        tabIndex={0}
        className="border-border bg-card relative max-h-[70vh] max-w-full overflow-auto rounded-xl border"
      >
        <table
          aria-label={tabela.titulo}
          className="w-full border-separate border-spacing-0 text-sm"
        >
          <thead className="text-muted-foreground sticky top-0 z-10">
            <tr>
              {tabela.colunas.map((c, i) => (
                <th
                  key={c.id}
                  scope="col"
                  className={cn(
                    "bg-muted border-border border-b px-3 py-2 text-xs font-medium whitespace-nowrap",
                    direita(c.formato) ? "text-right" : "text-left",
                    i === 0 && "sticky left-0 z-20",
                  )}
                >
                  {c.rotulo}
                </th>
              ))}
              {comAcoes ? (
                <th
                  scope="col"
                  className="bg-muted border-border border-b px-3 py-2 text-left text-xs font-medium"
                >
                  Ações
                </th>
              ) : null}
              <th
                scope="col"
                className="bg-muted border-border w-14 border-b px-3 py-2 text-right text-xs font-medium"
              >
                Detalhes
              </th>
            </tr>
          </thead>
          <tbody>
            {tabela.linhas.map((l) => (
              <tr key={l.id} className="hover:bg-muted/40">
                {tabela.colunas.map((c, i) => {
                  const conteudo = (
                    <ValorFormatado valor={l.celulas[c.id] ?? null} formato={c.formato} />
                  );
                  const classe = cn(
                    "border-border border-b px-3 py-2 whitespace-nowrap",
                    direita(c.formato) ? "text-right tabular-nums" : "text-left",
                  );
                  return i === 0 ? (
                    <th
                      key={c.id}
                      scope="row"
                      className={cn(classe, "bg-card sticky left-0 font-medium")}
                    >
                      {conteudo}
                    </th>
                  ) : (
                    <td key={c.id} className={classe}>
                      {conteudo}
                    </td>
                  );
                })}
                {comAcoes ? (
                  <td className="border-border border-b px-3 py-1.5 whitespace-nowrap">
                    <span className="flex gap-2">
                      {acoesDe(l).map(({ a, href }) => (
                        <Link
                          key={a.assistente}
                          href={href}
                          scroll={false}
                          aria-label={`${a.rotulo}: ${l.item}`}
                          className="border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-lg border px-2.5 text-xs outline-none focus-visible:ring-3"
                        >
                          {a.rotulo}
                        </Link>
                      ))}
                    </span>
                  </td>
                ) : null}
                <td className="border-border border-b px-3 py-2 text-right">
                  <BotaoDoOlho
                    item={l.item}
                    {...(l.href ? { hrefDaFicha: l.href } : {})}
                    detalhes={(l.detalhes.length > 0
                      ? l.detalhes
                      : tabela.colunas.map((c) => ({
                          rotulo: c.rotulo,
                          valor: l.celulas[c.id] ?? null,
                          formato: c.formato,
                        }))
                    ).map((d) => ({
                      rotulo: d.rotulo,
                      valor: <ValorFormatado valor={d.valor} formato={d.formato} />,
                    }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginasDaLista
        rotulo={`Páginas de ${tabela.titulo.toLowerCase()}`}
        total={tabela.total}
        unidade="linhas"
        pagina={tabela.pagina}
        paginas={tabela.paginas}
        endereco={enderecoDaPagina}
        tam={tabela.tam}
        enderecoDoTamanho={enderecoDoTamanho}
        testId="total-do-painel"
      />
    </section>
  );
}
