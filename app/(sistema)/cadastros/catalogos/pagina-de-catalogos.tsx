import Link from "next/link";
import { connection } from "next/server";
import { formatarInteiro } from "@/components/formato/numero";
import { PaginaDeLeitura } from "@/components/layout/pagina-de-leitura";
import { CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import { EsqueletoDaTabela, ListaVazia } from "@/components/tabela/estados";
import { Button } from "@/components/ui/button";
import {
  type ClienteDeCadastros,
  catalogoEhEditavel,
  listarCatalogo,
} from "@/lib/dados/catalogos-cadastro";
import {
  CATALOGOS,
  catalogoPorId,
  TAMANHO_DA_PAGINA_DO_CATALOGO,
} from "@/lib/dados/catalogos-definicoes";
import { modoDosDados } from "@/lib/dados/fonte";
import { acharTela } from "@/lib/navegacao/catalogo";
import { temPermissao } from "@/lib/seguranca/exigir-permissao";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { criarClienteDoServidor } from "@/lib/supabase/servidor";
import { cn } from "@/lib/utils";
import { CatalogoInterativo } from "./catalogo-interativo";

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;

const ROTA = "/cadastros/catalogos";

const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function cabecalho() {
  const tela = acharTela(ROTA)?.tela;
  return { titulo: tela?.nome ?? "Catálogos e parâmetros", descricao: tela?.descricao };
}

/** O endereço da tela com os parâmetros de estado (catálogo, busca, página, arquivados). */
export function enderecoDosCatalogos(estado: {
  catalogo: string;
  busca?: string;
  pagina?: number;
  arquivados?: boolean;
}): string {
  const p = new URLSearchParams();
  p.set("catalogo", estado.catalogo);
  if (estado.busca) p.set("q", estado.busca);
  if (estado.arquivados) p.set("arquivados", "1");
  if (estado.pagina && estado.pagina > 1) p.set("pagina", String(estado.pagina));
  return `${ROTA}?${p.toString()}`;
}

export function PaginaDeCatalogosCarregando() {
  const { titulo, descricao } = cabecalho();
  return (
    <PaginaDeLeitura lista titulo={titulo} descricao={descricao}>
      <EsqueletoDaTabela rotulo="Carregando catálogo" />
    </PaginaDeLeitura>
  );
}

export async function PaginaDeCatalogos({ searchParams }: { searchParams: ParametrosDaBusca }) {
  await connection();
  const bruto = await searchParams;
  const definicao = catalogoPorId(primeiro(bruto.catalogo));
  const busca = (primeiro(bruto.q) ?? "").trim();
  const arquivados = primeiro(bruto.arquivados) === "1";
  const pedida = Number(primeiro(bruto.pagina));
  const { titulo, descricao } = cabecalho();
  const sessao = await exigirSessao();

  const navegacao = (
    <nav aria-label="Catálogos" className="flex flex-wrap gap-2">
      {CATALOGOS.map((c) => (
        <Link
          key={c.id}
          href={enderecoDosCatalogos({ catalogo: c.id })}
          aria-current={c.id === definicao.id ? "page" : undefined}
          className={cn(
            "focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm outline-none focus-visible:ring-3",
            c.id === definicao.id
              ? "border-primary bg-primary/10 text-foreground font-medium"
              : "border-border bg-card hover:bg-muted",
          )}
        >
          {c.nome}
        </Link>
      ))}
    </nav>
  );
  const consulta = (
    <div className="flex flex-col gap-3">
      {navegacao}
      <form
        role="search"
        aria-label="Consulta"
        method="get"
        action={ROTA}
        className="flex flex-wrap items-center gap-3"
      >
        <input type="hidden" name="catalogo" value={definicao.id} />
        <input
          type="search"
          name="q"
          defaultValue={busca}
          aria-label={`Buscar em ${definicao.nome.toLowerCase()}`}
          placeholder="Buscar pelo nome"
          autoComplete="off"
          className={cn(CLASSE_DO_CAMPO, "max-w-sm")}
        />
        {definicao.comArquivo ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="arquivados" value="1" defaultChecked={arquivados} />
            Incluir arquivados
          </label>
        ) : null}
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>
    </div>
  );

  if (modoDosDados() === "exemplo") {
    return (
      <PaginaDeLeitura lista titulo={titulo} descricao={descricao} consulta={navegacao}>
        <ListaVazia
          titulo="Os catálogos leem do banco"
          descricao="Esta tela só funciona com o banco local ligado. Abra o sistema sem o modo de exemplo para ver os catálogos."
        />
      </PaginaDeLeitura>
    );
  }

  const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeCadastros;
  const pagina = await listarCatalogo(cliente, definicao, {
    busca,
    pagina: Number.isFinite(pedida) ? pedida : 1,
    arquivados,
  });
  const editavel =
    definicao.editavel && catalogoEhEditavel(definicao.editavel) ? definicao.editavel : null;
  const permissoes = {
    criar: temPermissao(sessao.perfil, { modulo: "cadastros", acao: "criar" }),
    editar: temPermissao(sessao.perfil, { modulo: "cadastros", acao: "editar" }),
    arquivar: temPermissao(sessao.perfil, { modulo: "cadastros", acao: "excluir" }),
  };
  const de = pagina.total === 0 ? 0 : (pagina.pagina - 1) * TAMANHO_DA_PAGINA_DO_CATALOGO + 1;
  const ate = Math.min(pagina.pagina * TAMANHO_DA_PAGINA_DO_CATALOGO, pagina.total);
  const estado = { catalogo: definicao.id, busca, arquivados };

  return (
    <PaginaDeLeitura lista titulo={titulo} descricao={descricao} consulta={consulta}>
      <p data-testid="resumo-da-pagina" className="text-muted-foreground text-sm">
        {pagina.total === 0
          ? `Nenhum item em ${definicao.nome.toLowerCase()}.`
          : `${definicao.descricao} Mostrando ${formatarInteiro(de)} a ${formatarInteiro(ate)} de ${formatarInteiro(pagina.total)}.`}
      </p>
      <CatalogoInterativo
        definicao={definicao}
        editavel={editavel}
        linhas={pagina.linhas}
        permissoes={permissoes}
        usuario={sessao.usuarioId}
        vazio={
          <ListaVazia
            titulo={
              busca || arquivados
                ? "Nada encontrado"
                : `Ainda não há itens em ${definicao.nome.toLowerCase()}`
            }
            descricao={
              busca
                ? "Nenhum item tem esse nome. Limpe a busca ou confira a escrita."
                : editavel && permissoes.criar
                  ? "Use o botão de cadastrar para incluir o primeiro."
                  : "Quando houver itens, eles aparecem aqui."
            }
            hrefLimpar={
              busca || arquivados ? enderecoDosCatalogos({ catalogo: definicao.id }) : undefined
            }
          />
        }
      />
      {pagina.paginas > 1 ? (
        <nav aria-label="Páginas" className="flex items-center gap-3 text-sm">
          {pagina.pagina > 1 ? (
            <Link
              href={enderecoDosCatalogos({ ...estado, pagina: pagina.pagina - 1 })}
              rel="prev"
              className="underline"
            >
              Página anterior
            </Link>
          ) : null}
          <span>
            Página {formatarInteiro(pagina.pagina)} de {formatarInteiro(pagina.paginas)}
          </span>
          {pagina.pagina < pagina.paginas ? (
            <Link
              href={enderecoDosCatalogos({ ...estado, pagina: pagina.pagina + 1 })}
              rel="next"
              className="underline"
            >
              Próxima página
            </Link>
          ) : null}
        </nav>
      ) : null}
    </PaginaDeLeitura>
  );
}
