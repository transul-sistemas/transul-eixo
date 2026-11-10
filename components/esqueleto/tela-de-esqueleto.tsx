import { IconEye, IconInfoCircle } from "@tabler/icons-react";
import { notFound } from "next/navigation";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { CelulaDaGrade, GradeDePaineis } from "@/components/layout/grade-de-paineis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { PainelDeGrafico } from "@/components/layout/painel-de-grafico";
import { acharTela } from "@/lib/navegacao/catalogo";
import { ESQUELETOS, type TabelaDoEsqueleto } from "@/lib/navegacao/esqueletos";

/** O texto de toda parte sem fonte: diz do que ela depende, nunca mostra número. */
export function textoSemDados(fonte: string): string {
  return `Sem dados ainda: depende de ${fonte}`;
}

/**
 * A tabela de detalhe da tela esqueleto: o cabeçalho de verdade, uma linha sem dados e o olho como
 * último botão (desligado, porque ainda não há linha para detalhar).
 */
function TabelaSemDados({ tabela, fonte }: { tabela: TabelaDoEsqueleto; fonte: string }) {
  return (
    <section aria-label={tabela.titulo} className="flex min-w-0 flex-col gap-2">
      <h2 className="text-lg font-semibold">{tabela.titulo}</h2>
      <div className="border-border bg-card relative max-w-full overflow-x-auto rounded-xl border">
        <table
          aria-label={tabela.titulo}
          className="w-full border-separate border-spacing-0 text-sm"
        >
          <thead>
            <tr>
              {tabela.colunas.map((coluna) => (
                <th
                  key={coluna}
                  scope="col"
                  className="text-muted-foreground bg-card border-border border-b px-3 py-2 text-left text-xs font-medium whitespace-nowrap"
                >
                  {coluna}
                </th>
              ))}
              <th
                scope="col"
                className="text-muted-foreground bg-card border-border w-14 border-b px-3 py-2 text-right text-xs font-medium"
              >
                Detalhes
              </th>
            </tr>
          </thead>
          <tbody>
            <tr data-linha-sem-dados="">
              {tabela.colunas.map((coluna) => (
                <td key={coluna} className="text-muted-foreground px-3 py-2">
                  —
                </td>
              ))}
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  disabled
                  aria-label={`Ver detalhes de ${tabela.item}`}
                  data-olho={tabela.item}
                  className="text-muted-foreground inline-grid size-7 place-items-center rounded opacity-50"
                >
                  <IconEye aria-hidden className="size-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p data-sem-dados className="text-muted-foreground text-sm">
        {textoSemDados(fonte)}. Quando houver linhas, a lista abre com 20 por página e o olho de
        cada linha abre o detalhe.
      </p>
    </section>
  );
}

/**
 * A tela esqueleto, inteira e no padrão de telas: título e ações, faixa de KPIs, visão principal,
 * painéis de apoio e a tabela com o olho. Lê a estrutura de `lib/navegacao/esqueletos.ts` e o nome e a
 * descrição do catálogo. Sem fonte de dados, mostra "Sem dados ainda: depende de ...".
 */
export function TelaDeEsqueleto({ rota }: { rota: string }) {
  const achada = acharTela(rota);
  if (!achada) notFound();
  const { tela } = achada;
  const esqueleto = ESQUELETOS[tela.id];
  if (!esqueleto) {
    throw new Error(`A tela ${tela.id} não tem estrutura em lib/navegacao/esqueletos.ts`);
  }
  const semDados = textoSemDados(esqueleto.fonte);
  return (
    <PaginaDeLeitura
      titulo={tela.nome}
      descricao={tela.descricao}
      acoes={esqueleto.acoes.map((acao) => (
        <button
          key={acao}
          type="button"
          disabled
          title={semDados}
          className="border-input bg-card inline-flex h-9 items-center rounded-lg border px-3 text-sm opacity-50"
        >
          {acao}
        </button>
      ))}
      kpis={
        <FaixaDeKpis
          kpis={esqueleto.kpis.map((kpi) => ({
            id: kpi.id,
            rotulo: kpi.rotulo,
            valor: null,
            semDados,
          }))}
        />
      }
    >
      <p
        role="note"
        className="bg-muted text-muted-foreground flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
      >
        <IconInfoCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
        Estrutura da tela: o desenho já está no padrão, mas ainda não há fonte de dados. Só
        Administrador e Diretoria veem esta tela.
      </p>
      <GradeDePaineis>
        <CelulaDaGrade colunas={12}>
          <PainelDeGrafico
            titulo={esqueleto.principal.titulo}
            descricao={esqueleto.principal.descricao}
            estado="vazio"
            textoVazio={semDados}
            alturaMinima={280}
          />
        </CelulaDaGrade>
        {esqueleto.apoio.map((painel) => (
          <CelulaDaGrade key={painel.titulo} colunas={painel.colunas}>
            <PainelDeGrafico
              titulo={painel.titulo}
              descricao={painel.descricao}
              estado="vazio"
              textoVazio={semDados}
              alturaMinima={200}
            />
          </CelulaDaGrade>
        ))}
      </GradeDePaineis>
      <TabelaSemDados tabela={esqueleto.tabela} fonte={esqueleto.fonte} />
    </PaginaDeLeitura>
  );
}
