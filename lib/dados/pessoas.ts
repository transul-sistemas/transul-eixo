import { falhaDeLeitura } from "@/lib/erros/leitura";
import type {
  EntradaCadastrarPessoa,
  EntradaEditarPessoa,
  EntradaMarcarEscala,
  SiglaDaEscala,
} from "@/lib/dominio/esquemas/pessoa";
import type { EstadoDaEscala, EstadoDasPessoas } from "@/lib/navegacao/pessoas";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ErroDoBanco, resultadoDoErro } from "./escrita-do-banco";
import type {
  EscalaDoMes,
  FichaDaPessoa,
  LinhaDePessoa,
  PessoasDaLista,
  SituacaoDaPessoa,
  VinculoDaPessoa,
} from "./pessoas-tipos";

export type * from "./pessoas-tipos";

// A leitura e a escrita de Pessoas (lista, ficha, cadastro, edição) e da Escala: só o banco, com a
// sessão de quem usa (a RLS e a permissão ficam no banco). Quem filtra, ordena, pagina e soma é o
// banco; aqui só se converte o formato. Toda gravação é uma função atômica que devolve a linha; o erro
// do banco vira um resultado tipado (sem permissão, conflito de versão, CPF repetido, regra).

interface Resposta {
  data: unknown;
  error: ErroDoBanco | null;
}

/** O pedaço do cliente do Supabase que Pessoas usa (nos testes, um simulado). */
export interface ClienteDasPessoas {
  schema(esquema: "nucleo"): {
    rpc(funcao: string, argumentos?: Record<string, unknown>): PromiseLike<Resposta>;
  };
}

async function clienteDaSessao(): Promise<ClienteDasPessoas> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDasPessoas;
}

const ordemDe = (o: { campo: string; sentido: "asc" | "desc" }) =>
  `${o.sentido === "desc" ? "-" : ""}${o.campo}`;
const mesDe = (data: string) => data.slice(0, 7);

interface LinhaDoBanco {
  id: string;
  nome: string;
  documento_mascarado: string | null;
  situacao: SituacaoDaPessoa;
  funcao: string | null;
  funcao_nome: string | null;
  operacao_id: string | null;
  operacao: string | null;
  desde: string | null;
}

interface ListaDoBanco {
  linhas: LinhaDoBanco[];
  filtradas: number;
  pagina: number;
  paginas: number;
  tam: number;
  chips: Record<string, number>;
  operacoes: { id: string; nome: string }[];
}

export async function lerPessoasDaLista(
  estado: EstadoDasPessoas,
  cliente: () => Promise<ClienteDasPessoas> = clienteDaSessao,
): Promise<PessoasDaLista> {
  const c = await cliente();
  const { consulta } = estado;
  const { data, error } = await c.schema("nucleo").rpc("pessoas_da_lista", {
    p_busca: consulta.busca === "" ? null : consulta.busca,
    p_chips: consulta.chips.length === 0 ? null : consulta.chips,
    p_operacao: estado.operacao,
    p_ordem: ordemDe(consulta.ordem),
    p_pagina: consulta.pagina,
    p_tam: consulta.tam,
  });
  if (error) throw falhaDeLeitura("pessoas_da_lista", error);
  const d = data as ListaDoBanco;
  return {
    linhas: d.linhas.map((l): LinhaDePessoa => ({
      id: l.id,
      nome: l.nome,
      documentoMascarado: l.documento_mascarado,
      situacao: l.situacao,
      funcao: l.funcao,
      funcaoNome: l.funcao_nome,
      operacaoId: l.operacao_id,
      operacao: l.operacao,
      desde: l.desde,
    })),
    filtradas: d.filtradas,
    pagina: d.pagina,
    paginas: d.paginas,
    tam: d.tam,
    chips: d.chips,
    operacoes: d.operacoes,
  };
}

interface VinculoDoBanco {
  id: string;
  operacao_id: string;
  operacao: string;
  funcao: string;
  funcao_nome: string;
  inicio: string;
  fim: string | null;
  vigente: boolean;
}

interface FichaDoBanco {
  pessoa: {
    id: string;
    nome: string;
    documento_mascarado: string | null;
    email: string | null;
    codparc: number | null;
    cadastro_pendente: boolean;
    versao: number;
    papeis: string[];
  };
  vinculos: VinculoDoBanco[];
  vinculo_atual: VinculoDoBanco | null;
  escala: { mes: string } & Record<SiglaDaEscala, number>;
  operacoes: { id: string; nome: string }[];
}

function vinculoDe(v: VinculoDoBanco): VinculoDaPessoa {
  return {
    id: v.id,
    operacaoId: v.operacao_id,
    operacao: v.operacao,
    funcao: v.funcao,
    funcaoNome: v.funcao_nome,
    inicio: v.inicio,
    fim: v.fim,
    vigente: v.vigente,
  };
}

/** A ficha da pessoa, ou nulo se ela não existe ou foi arquivada. */
export async function lerFichaDaPessoa(
  id: string,
  cliente: () => Promise<ClienteDasPessoas> = clienteDaSessao,
): Promise<FichaDaPessoa | null> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("ficha_da_pessoa", { p_pessoa: id });
  if (error) throw falhaDeLeitura("ficha_da_pessoa", error);
  if (data === null || data === undefined) return null;
  const d = data as FichaDoBanco;
  return {
    pessoa: {
      id: d.pessoa.id,
      nome: d.pessoa.nome,
      documentoMascarado: d.pessoa.documento_mascarado,
      email: d.pessoa.email,
      codparc: d.pessoa.codparc,
      cadastroPendente: d.pessoa.cadastro_pendente,
      versao: d.pessoa.versao,
      papeis: d.pessoa.papeis,
    },
    vinculos: d.vinculos.map(vinculoDe),
    vinculoAtual: d.vinculo_atual ? vinculoDe(d.vinculo_atual) : null,
    escala: { ...d.escala, mes: mesDe(d.escala.mes) },
    operacoes: d.operacoes,
  };
}

interface EscalaDoBanco {
  mes: string;
  dias_no_mes: number;
  operacao: { id: string; nome: string } | null;
  operacoes: { id: string; nome: string }[];
  pode_marcar: boolean;
  pessoas: {
    id: string;
    nome: string;
    funcao_nome: string;
    periodos: { inicio: string; fim: string | null }[];
    dias: Record<string, { sigla: SiglaDaEscala; versao: number }>;
  }[];
  totais: { pessoas: number } & Record<SiglaDaEscala, number>;
}

export async function lerEscalaDoMes(
  estado: EstadoDaEscala,
  cliente: () => Promise<ClienteDasPessoas> = clienteDaSessao,
): Promise<EscalaDoMes> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("escala_do_mes", {
    p_operacao: estado.operacao,
    p_mes: estado.mes ? `${estado.mes}-01` : null,
  });
  if (error) throw falhaDeLeitura("escala_do_mes", error);
  const d = data as EscalaDoBanco;
  return {
    mes: mesDe(d.mes),
    diasNoMes: d.dias_no_mes,
    operacao: d.operacao,
    operacoes: d.operacoes,
    podeMarcar: d.pode_marcar,
    pessoas: d.pessoas.map((p) => ({
      id: p.id,
      nome: p.nome,
      funcaoNome: p.funcao_nome,
      periodos: p.periodos,
      dias: p.dias,
    })),
    totais: d.totais,
  };
}

// ---------- escrita ----------

export interface PessoaGravada {
  id: string;
  nome: string;
  versao: number;
}

export interface MarcacaoGravada {
  id: string;
  dia: string;
  sigla: SiglaDaEscala;
  versao: number;
}

const ouNulo = (texto: string) => (texto === "" ? null : texto);

/** Cadastrar a pessoa (e o vínculo, se veio a operação). CPF repetido vira erro no campo CPF. */
export async function cadastrarPessoa(
  cliente: ClienteDasPessoas,
  entrada: EntradaCadastrarPessoa,
): Promise<ResultadoDaAcao<PessoaGravada>> {
  const { data, error } = await cliente.schema("nucleo").rpc("cadastrar_pessoa", {
    p_nome: entrada.nome,
    p_documento: entrada.cpf,
    p_email: ouNulo(entrada.email),
    p_operacao: ouNulo(entrada.operacaoId),
    p_funcao: entrada.operacaoId === "" ? null : ouNulo(entrada.funcao),
    p_inicio: entrada.operacaoId === "" ? null : ouNulo(entrada.inicio),
  });
  if (error) {
    if (error.code === "23505") {
      return erroDaAcao("entrada_invalida", { campos: { cpf: [error.message] } });
    }
    return resultadoDoErro<PessoaGravada>(error);
  }
  return sucesso(data as PessoaGravada);
}

/** Editar a pessoa com a versão que se viu; mudar a operação ou a função troca o vínculo. */
export async function editarPessoa(
  cliente: ClienteDasPessoas,
  entrada: EntradaEditarPessoa,
): Promise<ResultadoDaAcao<PessoaGravada>> {
  const { data, error } = await cliente.schema("nucleo").rpc("editar_pessoa", {
    p_pessoa: entrada.id,
    p_versao: entrada.versao,
    p_nome: entrada.nome,
    p_email: ouNulo(entrada.email),
    p_operacao: ouNulo(entrada.operacaoId),
    p_funcao: entrada.operacaoId === "" ? null : ouNulo(entrada.funcao),
    p_inicio: ouNulo(entrada.inicio),
  });
  if (error) return resultadoDoErro<PessoaGravada>(error);
  return sucesso(data as PessoaGravada);
}

/** Marcar o dia da escala (uma marcação por pessoa e dia), com a versão vista do dia. */
export async function marcarEscala(
  cliente: ClienteDasPessoas,
  entrada: EntradaMarcarEscala,
): Promise<ResultadoDaAcao<MarcacaoGravada>> {
  const { data, error } = await cliente.schema("nucleo").rpc("marcar_escala", {
    p_pessoa: entrada.pessoaId,
    p_operacao: entrada.operacaoId,
    p_dia: entrada.dia,
    p_sigla: entrada.sigla,
    p_versao: entrada.versao,
  });
  if (error) return resultadoDoErro<MarcacaoGravada>(error);
  return sucesso(data as MarcacaoGravada);
}
