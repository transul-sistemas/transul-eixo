import { IconInfoCircle } from "@tabler/icons-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { formatarMes, hojeEmSaoPaulo } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { ValorFormatado } from "@/components/formato/valor";
import { type CorDoGrafico, Grafico } from "@/components/grafico/grafico";
import { GraficoDeCascata } from "@/components/grafico/grafico-de-cascata";
import { GraficoDeRosca } from "@/components/grafico/grafico-de-rosca";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { CelulaDaGrade, GradeDePaineis } from "@/components/layout/grade-de-paineis";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { PainelDeGrafico } from "@/components/layout/painel-de-grafico";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { EsqueletoDaTabela } from "@/components/tabela/estados";
import { type IdDoPainel, lerPainel } from "@/lib/dados/paineis";
import type { CorDaSerie, GraficoDoPainel, LeituraDoPainel } from "@/lib/dados/painel-tipos";
import { passosDaCascata } from "@/lib/dominio/resultado-da-operacao";
import {
  ASSISTENTES_DOS_PAINEIS,
  type IdDoAssistenteDoPainel,
} from "@/lib/dominio/esquemas/paineis";
import { acharTela } from "@/lib/navegacao/catalogo";
import { ehLista, enderecoDoCsv } from "@/lib/navegacao/exportacao";
import { type EstadoDoPainel, enderecoDoPainel, lerEstadoDoPainel } from "@/lib/navegacao/painel";
import {
  lerTamanhoLembrado,
  NOME_DO_COOKIE_DO_TAMANHO,
} from "@/lib/navegacao/preferencias-da-tabela";
import { temPermissao } from "@/lib/seguranca/exigir-permissao";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { cn } from "@/lib/utils";
import { MODULOS, type Modulo } from "@/lib/visual/tons";
import { BotaoDoAssistenteDoPainel } from "./assistente-do-painel";
import { TabelaDoPainel } from "./tabela-do-painel";

// A tela de painel da Fase 1, no esqueleto de leitura (docs/padrao-de-telas.md): título e ações (os
// assistentes em popup) → contexto e consulta (mês, busca, chips com contagem) → KPIs → gráficos (o
// principal e os de apoio, 12 colunas por linha) → a tabela com o olho em toda linha e a paginação. Tudo
// vem pronto de UMA leitura (lib/dados/paineis.ts); a tela só formata. O estado fica na URL.

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

function paraParametros(bruto: Record<string, string | string[] | undefined>): URLSearchParams {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(bruto)) {
    const primeiro = Array.isArray(valor) ? valor[0] : valor;
    if (primeiro !== undefined) parametros.set(chave, primeiro);
  }
  return parametros;
}

function cabecalho(rota: string) {
  const achada = acharTela(rota);
  if (!achada) notFound();
  return {
    idDaTela: achada.tela.id,
    titulo: achada.tela.nome,
    descricao: achada.tela.descricao,
    // Início não tem cor de módulo própria: os gráficos usam o cinza de Cadastros.
    modulo: ((MODULOS as readonly string[]).includes(achada.modulo.id)
      ? achada.modulo.id
      : "cadastros") as Modulo,
  };
}

const classeDoLink =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";
const classeDoCampo = "border-input bg-card h-9 rounded-lg border px-2 text-sm";

function corDaSerie(cor: CorDaSerie | undefined, modulo: Modulo): CorDoGrafico {
  if (cor === "negativo" || cor === "acao") return cor;
  if (cor === "neutro") return { modulo: "cadastros" };
  return { modulo };
}

function ConteudoDoGrafico({ g, modulo }: { g: GraficoDoPainel; modulo: Modulo }) {
  if (g.tipo === "cascata" && g.cascata) {
    const c = g.cascata;
    return (
      <GraficoDeCascata
        rotulo={`${g.titulo}: receita, custos e margem`}
        passos={passosDaCascata({
          receitaCentavos: c.receitaCte + c.receitaNfse,
          receitaCteCentavos: c.receitaCte,
          receitaNfseCentavos: c.receitaNfse,
          custoFrotaCentavos: c.custoFrota,
          custoServicoCentavos: c.custoServico,
          margemCentavos: c.margem,
        })}
      />
    );
  }
  if (g.tipo === "rosca") {
    const valores = g.series[0]?.valores ?? [];
    return (
      <GraficoDeRosca
        rotulo={g.titulo}
        modulo={modulo}
        formato={g.formato === "moeda" ? "moeda" : "inteiro"}
        fatias={g.categorias.map((nome, i) => ({ nome, valor: valores[i] ?? 0 }))}
      />
    );
  }
  return (
    <Grafico
      rotulo={g.titulo}
      categorias={g.categorias}
      deitado={g.deitado}
      altura={
        g.deitado ? Math.max(200, 34 * g.categorias.length + 60) : g.colunas === 12 ? 300 : 240
      }
      formatos={[g.formato]}
      series={g.series.map((s) => ({
        nome: s.nome,
        tipo: s.tipo,
        cor: corDaSerie(s.cor, modulo),
        valores: s.valores,
        ...(s.pilha ? { pilha: s.pilha } : {}),
      }))}
    />
  );
}

function vazio(g: GraficoDoPainel): boolean {
  if (g.tipo === "cascata") return !g.cascata;
  return g.categorias.length === 0 || g.series.every((s) => s.valores.every((v) => !v));
}

/** O contexto (mês) e a busca: um formulário GET, para ficar na URL; mudar volta à página 1. */
function Consulta({
  rota,
  estado,
  leitura,
}: {
  rota: string;
  estado: EstadoDoPainel;
  leitura: LeituraDoPainel;
}) {
  const meses = leitura.meses;
  return (
    <div className="flex flex-col gap-3">
      <form
        method="get"
        action={rota}
        role="search"
        aria-label="Consulta"
        className="flex flex-wrap items-end gap-3"
      >
        {estado.filtro ? <input type="hidden" name="filtro" value={estado.filtro} /> : null}
        {meses.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Período</span>
            <select name="mes" defaultValue={leitura.mes ?? ""} className={classeDoCampo}>
              {meses.map((m) => (
                <option key={m} value={m}>
                  {formatarMes(m)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Buscar {leitura.tabela.item || "item"}</span>
          <input
            type="search"
            name="busca"
            defaultValue={estado.busca}
            maxLength={60}
            className={cn(classeDoCampo, "w-56 px-3")}
          />
        </label>
        <button type="submit" className={classeDoLink}>
          Aplicar
        </button>
      </form>
      {leitura.chips.length > 1 ? (
        <nav aria-label="Filtrar" className="flex flex-wrap gap-2">
          {leitura.chips.map((c) => {
            const id = c.id === "todos" ? null : c.id;
            const atual = estado.filtro === id;
            return (
              <Link
                key={c.id}
                href={enderecoDoPainel(rota, { ...estado, filtro: id, pagina: 1 })}
                aria-current={atual ? "page" : undefined}
                className={cn(
                  classeDoLink,
                  atual && "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                {c.nome}
                <span className="tabular-nums">{formatarInteiro(c.contagem)}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

function AvisoDaOrigem({ leitura }: { leitura: LeituraDoPainel }) {
  if (leitura.origem === "banco" && leitura.avisos.length === 0) return null;
  const itens = [
    ...(leitura.origem === "exemplo"
      ? [
          `Dados de exemplo (fictícios): a função ${leitura.funcao} ainda não existe no banco. Só fora de produção.`,
        ]
      : []),
    ...(leitura.origem === "sem-fonte"
      ? [`Sem dados ainda: depende de ${leitura.funcao} no banco.`]
      : []),
    ...leitura.avisos,
  ];
  return (
    <ul
      role="note"
      aria-label="Avisos da tela"
      className="bg-muted text-muted-foreground flex flex-col gap-1 rounded-lg px-3 py-2 text-sm"
    >
      {itens.map((t) => (
        <li key={t} className="flex items-start gap-2">
          <IconInfoCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t}
        </li>
      ))}
    </ul>
  );
}

export interface PropsDaTelaDePainel {
  id: IdDoPainel;
  rota: string;
  searchParams: ParametrosDaBusca;
  /** Os assistentes da tela (botões no topo, em popup; a URL `?assistente=` os abre). */
  assistentes?: readonly IdDoAssistenteDoPainel[];
  /** Algo a mais, abaixo da tabela (outra seção da mesma tela). */
  depois?: ReactNode;
}

export async function TelaDePainel({
  id,
  rota,
  searchParams,
  assistentes = [],
  depois,
}: PropsDaTelaDePainel) {
  await connection();
  const { idDaTela, titulo, descricao, modulo } = cabecalho(rota);
  const tamLembrado = lerTamanhoLembrado(
    (await cookies()).get(NOME_DO_COOKIE_DO_TAMANHO)?.value,
    20,
  );
  const parametros = paraParametros(await searchParams);
  const estado = lerEstadoDoPainel(parametros, tamLembrado);
  const hoje = hojeEmSaoPaulo(new Date());
  const [leitura, sessao] = await Promise.all([lerPainel(id, estado, hoje), exigirSessao()]);
  const semFonte = leitura.origem === "sem-fonte";
  const textoSemFonte = `Sem dados ainda: depende de ${leitura.funcao}`;
  const permitidos = assistentes.filter((a) =>
    temPermissao(sessao.perfil, ASSISTENTES_DOS_PAINEIS[a].permissao),
  );
  const [principal, ...apoio] = leitura.graficos;
  return (
    <ProvedorDoUsuario usuario={sessao.usuarioId}>
      <PaginaDeLeitura
        titulo={titulo}
        descricao={descricao}
        acoes={
          permitidos.length > 0
            ? permitidos.map((a) => (
                <BotaoDoAssistenteDoPainel key={a} id={a} opcoes={leitura.opcoes} hoje={hoje} />
              ))
            : undefined
        }
        consulta={<Consulta rota={rota} estado={estado} leitura={leitura} />}
        exportar={ehLista(idDaTela) && !semFonte ? enderecoDoCsv(idDaTela, parametros) : undefined}
        kpis={
          <FaixaDeKpis
            kpis={leitura.kpis.map((k) => ({
              id: k.id,
              rotulo: k.rotulo,
              valor: <ValorFormatado valor={k.valor} formato={k.formato} className="text-left" />,
              ...(k.apoio ? { apoio: k.apoio } : {}),
            }))}
          />
        }
      >
        <AvisoDaOrigem leitura={leitura} />
        {semFonte ? (
          <PainelDeGrafico titulo={titulo} estado="vazio" textoVazio={textoSemFonte} />
        ) : null}
        {principal ? (
          <GradeDePaineis>
            {[principal, ...apoio].map((g) => (
              <CelulaDaGrade key={g.id} colunas={g.colunas}>
                <PainelDeGrafico
                  titulo={g.titulo}
                  descricao={g.descricao}
                  estado={vazio(g) ? "vazio" : "ok"}
                  textoVazio="Nada a mostrar neste período."
                  alturaMinima={g.colunas === 12 ? 280 : 200}
                >
                  <ConteudoDoGrafico g={g} modulo={modulo} />
                </PainelDeGrafico>
              </CelulaDaGrade>
            ))}
          </GradeDePaineis>
        ) : null}
        {semFonte ? null : (
          <TabelaDoPainel
            tabela={leitura.tabela}
            enderecoDaPagina={(pagina) => enderecoDoPainel(rota, { ...estado, pagina })}
            enderecoDoTamanho={(tam) => enderecoDoPainel(rota, { ...estado, tam, pagina: 1 })}
            enderecoDaAcao={(acao) => {
              if (!(permitidos as readonly string[]).includes(acao.assistente)) return null;
              const p = new URLSearchParams(enderecoDoPainel(rota, estado).split("?")[1] ?? "");
              p.set("assistente", acao.assistente);
              for (const [campo, valor] of Object.entries(acao.valores))
                p.set(`pre.${campo}`, valor);
              return `${rota}?${p.toString()}`;
            }}
            hrefLimpar={
              estado.filtro || estado.busca
                ? enderecoDoPainel(rota, { ...estado, filtro: null, busca: "", pagina: 1 })
                : undefined
            }
          />
        )}
        {depois}
      </PaginaDeLeitura>
    </ProvedorDoUsuario>
  );
}

/** O que se vê enquanto a leitura chega: o título e o esqueleto. */
export function TelaDePainelCarregando({ rota }: { rota: string }) {
  const { titulo, descricao } = cabecalho(rota);
  return (
    <PaginaDeLeitura titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo={`Carregando ${titulo.toLowerCase()}`} />
    </PaginaDeLeitura>
  );
}
