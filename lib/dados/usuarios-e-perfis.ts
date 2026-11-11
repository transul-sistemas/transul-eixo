import { falhaDeLeitura } from "@/lib/erros/leitura";
import type { EntradaMudarAcesso } from "@/lib/dominio/esquemas/cadastro";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import type { ClienteDeCadastros } from "./catalogos-cadastro";
import { resultadoDoErro } from "./escrita-do-banco";
import type {
  DadosDaMatriz,
  ItemDeCatalogo,
  MatrizDoPerfil,
  UsuarioDaLista,
} from "./usuarios-tipos";

// Administração › Usuários e perfis (primeira versão): lista os usuários com perfil, escopo e situação,
// mostra a matriz do perfil (módulo × ação × escopo, lida de config.permissao_do_perfil) e muda o perfil
// e a situação de quem já tem login. Tudo com a sessão de quem usa (a RLS deixa só o Administrador
// gravar). O login novo nasce fora do app, no Studio, porque exige a chave mestra.

async function ler<T>(
  cliente: ClienteDeCadastros,
  esquema: "nucleo" | "config",
  tabela: string,
  colunas: string,
  ordem?: string,
  ids?: { coluna: string; valores: readonly string[] },
): Promise<T[]> {
  let consulta = cliente.schema(esquema).from(tabela).select(colunas);
  if (ids) consulta = consulta.in(ids.coluna, ids.valores);
  if (ordem) consulta = consulta.order(ordem, { ascending: true });
  const { data, error } = await consulta.range(0, 999);
  if (error) throw falhaDeLeitura(tabela, error);
  return (data ?? []) as T[];
}

const comCodigo = (linhas: { codigo: string; nome: string }[]) =>
  linhas.map((l) => ({ codigo: l.codigo, nome: l.nome }));

/** O catálogo de acesso inteiro (perfis, módulos, ações, escopos e as permissões de cada perfil). */
export async function lerMatriz(cliente: ClienteDeCadastros): Promise<DadosDaMatriz> {
  const [perfis, modulos, acoes, escopos, permissoes] = await Promise.all([
    ler<ItemDeCatalogo>(cliente, "config", "perfil", "codigo, nome", "nome"),
    ler<ItemDeCatalogo>(cliente, "config", "modulo", "codigo, nome", "codigo"),
    ler<ItemDeCatalogo>(cliente, "config", "acao", "codigo, nome", "codigo"),
    ler<ItemDeCatalogo>(cliente, "config", "escopo", "codigo, nome", "codigo"),
    ler<DadosDaMatriz["permissoes"][number]>(
      cliente,
      "config",
      "permissao_do_perfil",
      "perfil, modulo, acao, escopo",
      "perfil",
    ),
  ]);
  return {
    perfis: comCodigo(perfis),
    modulos: comCodigo(modulos),
    acoes: comCodigo(acoes),
    escopos: comCodigo(escopos),
    permissoes,
  };
}

// A ordem de leitura é a do cadastro; a das ações e dos módulos, a do uso (ver, criar, editar...).
const ORDEM_DAS_ACOES = ["ver", "criar", "editar", "excluir", "ver_documento"];
const ORDEM_DOS_MODULOS = [
  "inicio",
  "frota",
  "operacional",
  "operacoes",
  "pessoas",
  "parceiros",
  "resultados",
  "cadastros",
  "admin",
];
const pelaOrdem = (ordem: string[]) => (a: ItemDeCatalogo, b: ItemDeCatalogo) => {
  const ia = ordem.indexOf(a.codigo);
  const ib = ordem.indexOf(b.codigo);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.codigo.localeCompare(b.codigo);
};

/** A matriz de um perfil: módulos nas linhas, ações nas colunas. Perfil desconhecido cai no primeiro. */
export function matrizDoPerfil(
  dados: DadosDaMatriz,
  codigo: string | null | undefined,
): MatrizDoPerfil {
  const perfil = dados.perfis.find((p) => p.codigo === codigo) ?? dados.perfis[0];
  if (!perfil) return { perfil: { codigo: "", nome: "" }, acoes: [], linhas: [] };
  const acoes = [...dados.acoes].sort(pelaOrdem(ORDEM_DAS_ACOES));
  const nomeDoEscopo = new Map(dados.escopos.map((e) => [e.codigo, e.nome]));
  const doPerfil = dados.permissoes.filter((p) => p.perfil === perfil.codigo);
  return {
    perfil,
    acoes,
    linhas: [...dados.modulos].sort(pelaOrdem(ORDEM_DOS_MODULOS)).map((m) => ({
      modulo: m.nome,
      celulas: Object.fromEntries(
        acoes.map((a) => {
          const p = doPerfil.find((x) => x.modulo === m.codigo && x.acao === a.codigo);
          return [a.codigo, p ? (nomeDoEscopo.get(p.escopo) ?? p.escopo) : null];
        }),
      ),
    })),
  };
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Os usuários com perfil, escopo e situação; `busca` filtra pelo nome. */
export async function listarUsuarios(
  cliente: ClienteDeCadastros,
  busca: string,
): Promise<UsuarioDaLista[]> {
  const usuarios = await ler<{
    pessoa_id: string;
    perfil: string;
    ativo: boolean;
    versao: number;
  }>(cliente, "nucleo", "usuario", "pessoa_id, perfil, ativo, versao, criado_em", "criado_em");
  if (usuarios.length === 0) return [];
  const ids = usuarios.map((u) => u.pessoa_id);
  const [matriz, pessoas, comFilial, comOperacao] = await Promise.all([
    lerMatriz(cliente),
    ler<{ id: string; nome: string | null }>(
      cliente,
      "nucleo",
      "pessoa_para_leitura",
      "id, nome",
      undefined,
      {
        coluna: "id",
        valores: ids,
      },
    ),
    ler<{ usuario_id: string; filial_id: string }>(
      cliente,
      "nucleo",
      "usuario_filial",
      "usuario_id, filial_id",
      undefined,
      { coluna: "usuario_id", valores: ids },
    ),
    ler<{ usuario_id: string; operacao_id: string }>(
      cliente,
      "nucleo",
      "usuario_operacao",
      "usuario_id, operacao_id",
      undefined,
      { coluna: "usuario_id", valores: ids },
    ),
  ]);
  const nomesDeFilial = await nomesPorId(
    cliente,
    "config",
    "filial",
    comFilial.map((l) => l.filial_id),
  );
  const nomesDeOperacao = await nomesPorId(
    cliente,
    "nucleo",
    "operacao",
    comOperacao.map((l) => l.operacao_id),
  );
  const nomeDaPessoa = new Map(pessoas.map((p) => [p.id, p.nome ?? "Sem nome"]));
  const nomeDoPerfil = new Map(matriz.perfis.map((p) => [p.codigo, p.nome]));
  const nomeDoEscopo = new Map(matriz.escopos.map((e) => [e.codigo, e.nome]));
  const escoposDoPerfil = (perfil: string) => [
    ...new Set(
      matriz.permissoes
        .filter((p) => p.perfil === perfil)
        .map((p) => nomeDoEscopo.get(p.escopo) ?? p.escopo),
    ),
  ];
  const lista = usuarios.map((u): UsuarioDaLista => ({
    pessoaId: u.pessoa_id,
    nome: nomeDaPessoa.get(u.pessoa_id) ?? "Sem nome",
    perfil: u.perfil,
    perfilNome: nomeDoPerfil.get(u.perfil) ?? u.perfil,
    ativo: u.ativo,
    versao: u.versao,
    escopos: escoposDoPerfil(u.perfil),
    filiais: comFilial
      .filter((l) => l.usuario_id === u.pessoa_id)
      .map((l) => nomesDeFilial.get(l.filial_id) ?? ""),
    operacoes: comOperacao
      .filter((l) => l.usuario_id === u.pessoa_id)
      .map((l) => nomesDeOperacao.get(l.operacao_id) ?? ""),
  }));
  const termo = semAcento(busca.trim());
  return termo === "" ? lista : lista.filter((u) => semAcento(u.nome).includes(termo));
}

async function nomesPorId(
  cliente: ClienteDeCadastros,
  esquema: "nucleo" | "config",
  tabela: string,
  ids: string[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const linhas = await ler<{ id: string; nome: string }>(
    cliente,
    esquema,
    tabela,
    "id, nome",
    undefined,
    {
      coluna: "id",
      valores: unicos,
    },
  );
  return new Map(linhas.map((l) => [l.id, l.nome]));
}

export interface AcessoGravado {
  pessoa_id: string;
  perfil: string;
  ativo: boolean;
  versao: number;
}

/**
 * Muda o perfil e a situação de um usuário que já existe, conferindo a versão que a pessoa viu.
 * Ninguém muda o próprio acesso (evita o Administrador se trancar para fora); `quemMuda` é a pessoa
 * de quem está usando o sistema.
 */
export async function mudarAcesso(
  cliente: ClienteDeCadastros,
  entrada: EntradaMudarAcesso,
  quemMuda: string,
): Promise<ResultadoDaAcao<AcessoGravado>> {
  if (entrada.pessoaId === quemMuda) {
    return erroDaAcao("entrada_invalida", {
      mensagem: "Você não pode mudar o seu próprio acesso. Peça a outro Administrador.",
    });
  }
  const { data, error } = await cliente
    .schema("nucleo")
    .from("usuario")
    .update({ perfil: entrada.perfil, ativo: entrada.ativo })
    .eq("pessoa_id", entrada.pessoaId)
    .eq("versao", entrada.versao)
    .select("pessoa_id, perfil, ativo, versao")
    .maybeSingle();
  if (error) return resultadoDoErro<AcessoGravado>(error);
  // Nenhuma linha com esta versão: outra pessoa mudou o usuário (ou ele deixou de existir).
  if (data === null || data === undefined) return erroDaAcao("conflito");
  return sucesso(data as AcessoGravado);
}
