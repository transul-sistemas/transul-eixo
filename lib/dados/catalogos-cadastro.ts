import { formatarData } from "@/components/formato/data";
import {
  type ColunaDoCatalogo,
  type DefinicaoDoCatalogo,
  type PaginaDoCatalogo,
  TAMANHO_DA_PAGINA_DO_CATALOGO,
} from "./catalogos-definicoes";
import {
  CATALOGOS_EDITAVEIS,
  type CatalogoEditavel,
  type EntradaArquivarItem,
  type EntradaEditarItem,
  type EntradaIncluirItem,
} from "@/lib/dominio/esquemas/cadastro";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ErroDoBanco, resultadoDoErro } from "./escrita-do-banco";

// Cadastros › Catálogos (primeira versão): lê cada catálogo do banco com a sessão de quem usa (a RLS
// decide) e grava o que o Eixo é dono (carroceria, marca, filial e operação) por inclusão, edição e
// arquivamento (exclusão lógica, com motivo). O que é fato do Sankhya (CR) e a régua de status ficam só
// para leitura. A busca, a ordem (com desempate pela chave) e a página são do banco.

export interface ConsultaEncadeavel extends PromiseLike<{
  data: unknown;
  error: ErroDoBanco | null;
  count?: number | null;
}> {
  is(coluna: string, valor: null): ConsultaEncadeavel;
  ilike(coluna: string, padrao: string): ConsultaEncadeavel;
  in(coluna: string, valores: readonly string[]): ConsultaEncadeavel;
  order(coluna: string, opcoes?: { ascending: boolean }): ConsultaEncadeavel;
  range(de: number, ate: number): ConsultaEncadeavel;
}

type Resposta = PromiseLike<{ data: unknown; error: ErroDoBanco | null }>;

/** O pedaço do cliente do Supabase que os catálogos usam (nos testes, um simulado com esta forma). */
export interface ClienteDeCadastros {
  schema(esquema: "nucleo" | "config"): {
    from(tabela: string): {
      select(colunas: string, opcoes?: { count: "exact" }): ConsultaEncadeavel;
      insert(linha: Record<string, unknown>): { select(colunas: string): { single(): Resposta } };
      update(valores: Record<string, unknown>): {
        eq(
          coluna: string,
          valor: string | number,
        ): {
          eq(
            coluna: string,
            valor: string | number,
          ): { select(colunas: string): { maybeSingle(): Resposta } };
        };
      };
    };
  };
}

export interface ConsultaDoCatalogo {
  busca: string;
  pagina: number;
  arquivados: boolean;
}

type LinhaBruta = Record<string, string | number | boolean | null>;

/** Escapa o que o `ilike` trata como curinga. */
export function padraoDeBusca(busca: string): string {
  return `%${busca.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function celulaDe(
  coluna: ColunaDoCatalogo,
  linha: LinhaBruta,
  nomes: Map<string, Map<string, string>>,
): string {
  const bruto = linha[coluna.campo ?? coluna.id];
  if (bruto === null || bruto === undefined || bruto === "") return "";
  switch (coluna.formato) {
    case "data":
      return formatarData(String(bruto));
    case "sim_nao":
      return bruto === true ? "Sim" : "Não";
    case "numero":
      return String(bruto);
    case "referencia":
      return nomes.get(coluna.id)?.get(String(bruto)) ?? "";
    default:
      return String(bruto);
  }
}

export async function listarCatalogo(
  cliente: ClienteDeCadastros,
  definicao: DefinicaoDoCatalogo,
  { busca, pagina, arquivados }: ConsultaDoCatalogo,
): Promise<PaginaDoCatalogo> {
  const tam = TAMANHO_DA_PAGINA_DO_CATALOGO;
  const atual = Math.max(1, Math.trunc(pagina) || 1);
  let consulta = cliente
    .schema(definicao.esquema)
    .from(definicao.tabela)
    .select(definicao.selecao, { count: "exact" });
  if (definicao.comArquivo && !arquivados) consulta = consulta.is("excluido_em", null);
  if (busca.trim() !== "") consulta = consulta.ilike(definicao.busca, padraoDeBusca(busca));
  // Ordem pelo campo da tela e desempate pela chave única (a página não repete nem pula linha).
  consulta = consulta.order(definicao.ordem, { ascending: true });
  for (const coluna of definicao.chave) {
    if (coluna !== definicao.ordem) consulta = consulta.order(coluna, { ascending: true });
  }
  const { data, error, count } = await consulta.range((atual - 1) * tam, atual * tam - 1);
  if (error) throw new Error(`Não foi possível ler ${definicao.nome}: ${error.message}`);
  const brutas = (data ?? []) as LinhaBruta[];

  // Os nomes dos itens que as linhas referenciam (marca do modelo, filial da garagem...).
  const nomes = new Map<string, Map<string, string>>();
  for (const coluna of definicao.colunas) {
    if (coluna.formato !== "referencia" || !coluna.de) continue;
    const ids = [
      ...new Set(
        brutas
          .map((l) => l[coluna.campo ?? coluna.id])
          .filter((v): v is string => typeof v === "string"),
      ),
    ];
    const mapa = new Map<string, string>();
    if (ids.length > 0) {
      const r = await cliente
        .schema(coluna.de.esquema)
        .from(coluna.de.tabela)
        .select("id, nome")
        .in("id", ids);
      if (r.error) throw new Error(`Não foi possível ler ${coluna.titulo}: ${r.error.message}`);
      for (const item of (r.data ?? []) as { id: string; nome: string }[])
        mapa.set(item.id, item.nome);
    }
    nomes.set(coluna.id, mapa);
  }

  const total = count ?? brutas.length;
  return {
    linhas: brutas.map((l) => ({
      chave: definicao.chave.map((c) => String(l[c])).join("|"),
      id: String(l.id ?? ""),
      versao: Number(l.versao ?? 0),
      arquivado: l.excluido_em !== null && l.excluido_em !== undefined,
      motivo: typeof l.motivo_da_exclusao === "string" ? l.motivo_da_exclusao : null,
      celulas: Object.fromEntries(definicao.colunas.map((c) => [c.id, celulaDe(c, l, nomes)])),
    })),
    total,
    pagina: atual,
    paginas: Math.max(1, Math.ceil(total / tam)),
  };
}

// ---------- escrita ----------

const TABELA_DO_EDITAVEL: Record<
  CatalogoEditavel,
  { esquema: "nucleo" | "config"; tabela: string }
> = {
  carroceria: { esquema: "config", tabela: "carroceria" },
  marca: { esquema: "config", tabela: "marca" },
  filial: { esquema: "config", tabela: "filial" },
  operacao: { esquema: "nucleo", tabela: "operacao" },
};

export interface ItemGravado {
  id: string;
  nome: string;
  versao: number;
}

const COLUNAS_GRAVADAS = "id, nome, versao";

/** O erro de nome repetido vira mensagem no campo; o resto segue o resultado tipado do banco. */
function falhaDeGravacao(erro: ErroDoBanco): ResultadoDaAcao<ItemGravado> {
  if (erro.code === "23505") {
    return erroDaAcao("entrada_invalida", {
      campos: {
        nome: ["Já existe um item com este nome. Escolha outro nome ou edite o que existe."],
      },
    });
  }
  return resultadoDoErro<ItemGravado>(erro);
}

export async function incluirItem(
  cliente: ClienteDeCadastros,
  entrada: EntradaIncluirItem,
): Promise<ResultadoDaAcao<ItemGravado>> {
  const { esquema, tabela } = TABELA_DO_EDITAVEL[entrada.catalogo];
  const { data, error } = await cliente
    .schema(esquema)
    .from(tabela)
    .insert({ nome: entrada.nome })
    .select(COLUNAS_GRAVADAS)
    .single();
  if (error) return falhaDeGravacao(error);
  return sucesso(data as ItemGravado);
}

async function gravarComVersao(
  cliente: ClienteDeCadastros,
  catalogo: CatalogoEditavel,
  id: string,
  versao: number,
  valores: Record<string, unknown>,
): Promise<ResultadoDaAcao<ItemGravado>> {
  const { esquema, tabela } = TABELA_DO_EDITAVEL[catalogo];
  const { data, error } = await cliente
    .schema(esquema)
    .from(tabela)
    .update(valores)
    .eq("id", id)
    .eq("versao", versao)
    .select(COLUNAS_GRAVADAS)
    .maybeSingle();
  if (error) return falhaDeGravacao(error);
  // Nenhuma linha com esta versão: outra pessoa mudou o registro (ou ele deixou de existir).
  if (data === null || data === undefined) return erroDaAcao("conflito");
  return sucesso(data as ItemGravado);
}

export function editarItem(cliente: ClienteDeCadastros, entrada: EntradaEditarItem) {
  return gravarComVersao(cliente, entrada.catalogo, entrada.id, entrada.versao, {
    nome: entrada.nome,
  });
}

/** Exclusão lógica: quem arquivou, quando e por quê. Nada se apaga de verdade. */
export function arquivarItem(
  cliente: ClienteDeCadastros,
  entrada: EntradaArquivarItem,
  quem: string,
  agora: string,
) {
  return gravarComVersao(cliente, entrada.catalogo, entrada.id, entrada.versao, {
    excluido_em: agora,
    excluido_por: quem,
    motivo_da_exclusao: entrada.motivo,
  });
}

export const catalogoEhEditavel = (id: string): id is CatalogoEditavel =>
  (CATALOGOS_EDITAVEIS as readonly string[]).includes(id);
