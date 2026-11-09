import type { CatalogoEditavel } from "@/lib/dominio/esquemas/cadastro";

// As definições dos catálogos e os tipos da tela: sem acesso ao banco, então o navegador pode importar.

export const TAMANHO_DA_PAGINA_DO_CATALOGO = 50;

type Formato = "texto" | "data" | "sim_nao" | "numero" | "referencia";

export interface ColunaDoCatalogo {
  id: string;
  titulo: string;
  /** A coluna do banco de onde vem (padrão: o `id`). */
  campo?: string;
  formato?: Formato;
  /** Em `referencia`: de onde vem o nome (o `campo` guarda o id). */
  de?: { esquema: "nucleo" | "config"; tabela: string };
}

export const IDS_DOS_CATALOGOS = [
  "carroceria",
  "marca",
  "modelo",
  "filial",
  "garagem",
  "operacao",
  "cr",
  "status",
  "configuracao",
  "nomenclatura",
] as const;
export type IdDoCatalogo = (typeof IDS_DOS_CATALOGOS)[number];

export interface DefinicaoDoCatalogo {
  id: IdDoCatalogo;
  nome: string;
  /** Uma frase: o que o catálogo é e de quem é o dado. */
  descricao: string;
  esquema: "nucleo" | "config";
  tabela: string;
  /** As colunas pedidas ao banco (só as necessárias). */
  selecao: string;
  /** As colunas da chave (mais de uma na nomenclatura). */
  chave: readonly string[];
  busca: string;
  ordem: string;
  comArquivo: boolean;
  /** O catálogo que o assistente edita; nulo é só leitura. */
  editavel: CatalogoEditavel | null;
  /** Por que não se edita aqui (mostrado na tela). */
  somenteLeituraPorque?: string;
  colunas: readonly ColunaDoCatalogo[];
}

const CRIADA: ColunaDoCatalogo = { id: "criado_em", titulo: "Criado em", formato: "data" };

const DO_EIXO = "Cadastro do Eixo: inclua, edite e arquive pelos botões da tela.";

export const CATALOGOS: readonly DefinicaoDoCatalogo[] = [
  {
    id: "carroceria",
    nome: "Carrocerias",
    descricao: `Tipos de carroceria dos implementos e caminhões. ${DO_EIXO}`,
    esquema: "config",
    tabela: "carroceria",
    selecao: "id, nome, versao, criado_em, excluido_em, motivo_da_exclusao",
    chave: ["id"],
    busca: "nome",
    ordem: "nome",
    comArquivo: true,
    editavel: "carroceria",
    colunas: [{ id: "nome", titulo: "Nome" }, CRIADA],
  },
  {
    id: "marca",
    nome: "Marcas",
    descricao: `Marcas de veículo. ${DO_EIXO}`,
    esquema: "config",
    tabela: "marca",
    selecao: "id, nome, versao, criado_em, excluido_em, motivo_da_exclusao",
    chave: ["id"],
    busca: "nome",
    ordem: "nome",
    comArquivo: true,
    editavel: "marca",
    colunas: [{ id: "nome", titulo: "Nome" }, CRIADA],
  },
  {
    id: "modelo",
    nome: "Modelos",
    descricao: "Modelos de veículo, por marca. Entram pelo + do cadastro da placa.",
    esquema: "config",
    tabela: "modelo",
    selecao: "id, nome, marca_id, eixos, versao, criado_em, excluido_em, motivo_da_exclusao",
    chave: ["id"],
    busca: "nome",
    ordem: "nome",
    comArquivo: true,
    editavel: null,
    somenteLeituraPorque: "O modelo se cadastra pelo + do cadastro da placa, escolhendo a marca.",
    colunas: [
      { id: "nome", titulo: "Nome" },
      {
        id: "marca",
        titulo: "Marca",
        campo: "marca_id",
        formato: "referencia",
        de: { esquema: "config", tabela: "marca" },
      },
      { id: "eixos", titulo: "Eixos", formato: "numero" },
    ],
  },
  {
    id: "filial",
    nome: "Filiais",
    descricao: `Filiais da TranSul. ${DO_EIXO}`,
    esquema: "config",
    tabela: "filial",
    selecao: "id, nome, versao, criado_em, excluido_em, motivo_da_exclusao",
    chave: ["id"],
    busca: "nome",
    ordem: "nome",
    comArquivo: true,
    editavel: "filial",
    colunas: [{ id: "nome", titulo: "Nome" }, CRIADA],
  },
  {
    id: "garagem",
    nome: "Garagens",
    descricao: "Garagens, por filial.",
    esquema: "config",
    tabela: "garagem",
    selecao: "id, nome, filial_id, versao, criado_em, excluido_em, motivo_da_exclusao",
    chave: ["id"],
    busca: "nome",
    ordem: "nome",
    comArquivo: true,
    editavel: null,
    somenteLeituraPorque: "A garagem nasce junto com a filial, na ponte do Sankhya.",
    colunas: [
      { id: "nome", titulo: "Nome" },
      {
        id: "filial",
        titulo: "Filial",
        campo: "filial_id",
        formato: "referencia",
        de: { esquema: "config", tabela: "filial" },
      },
    ],
  },
  {
    id: "operacao",
    nome: "Operações",
    descricao: `Operações da TranSul (Grãos, Cimento e outras); o CR aponta para uma. ${DO_EIXO}`,
    esquema: "nucleo",
    tabela: "operacao",
    selecao: "id, nome, versao, criado_em, excluido_em, motivo_da_exclusao",
    chave: ["id"],
    busca: "nome",
    ordem: "nome",
    comArquivo: true,
    editavel: "operacao",
    colunas: [{ id: "nome", titulo: "Nome" }, CRIADA],
  },
  {
    id: "cr",
    nome: "CRs",
    descricao: "Centros de resultado. O Sankhya é o dono do fato: aqui só se consulta.",
    esquema: "nucleo",
    tabela: "cr",
    selecao:
      "id, codigo, codcencus, nome, operacao_id, ativo, bloqueado, excluido_em, motivo_da_exclusao",
    chave: ["id"],
    busca: "codigo",
    ordem: "codigo",
    comArquivo: true,
    editavel: null,
    somenteLeituraPorque:
      "O CR vem do Sankhya; a correção é um ajuste justificado, não uma edição.",
    colunas: [
      { id: "codigo", titulo: "Código" },
      { id: "codcencus", titulo: "CODCENCUS", formato: "numero" },
      { id: "nome", titulo: "Nome" },
      {
        id: "operacao",
        titulo: "Operação",
        campo: "operacao_id",
        formato: "referencia",
        de: { esquema: "nucleo", tabela: "operacao" },
      },
      { id: "ativo", titulo: "Ativo no Sankhya", formato: "sim_nao" },
      { id: "bloqueado", titulo: "Bloqueado", formato: "sim_nao" },
    ],
  },
  {
    id: "status",
    nome: "Régua de status",
    descricao: "As siglas da régua única, com o chip, a camada e a que se aplicam.",
    esquema: "config",
    tabela: "status",
    selecao: "sigla, nome, chip, camada, aplica_a, ordem",
    chave: ["sigla"],
    busca: "nome",
    ordem: "ordem",
    comArquivo: false,
    editavel: null,
    somenteLeituraPorque: "A régua só muda por decisão da equipe, registrada na Administração.",
    colunas: [
      { id: "sigla", titulo: "Sigla" },
      { id: "nome", titulo: "Nome" },
      { id: "chip", titulo: "Chip" },
      { id: "camada", titulo: "Camada" },
      { id: "aplica_a", titulo: "Vale para" },
    ],
  },
  {
    id: "configuracao",
    nome: "Configurações de conjunto",
    descricao: "Simples, bi, bitrezão e rodo, com a estrutura que cada uma pede.",
    esquema: "config",
    tabela: "configuracao_de_conjunto",
    selecao: "codigo, nome, quantidade_de_implementos, com_dolly, eixos_por_implemento",
    chave: ["codigo"],
    busca: "nome",
    ordem: "nome",
    comArquivo: false,
    editavel: null,
    somenteLeituraPorque: "A regra do conjunto é da equipe e vem do projeto técnico.",
    colunas: [
      { id: "codigo", titulo: "Código" },
      { id: "nome", titulo: "Nome" },
      { id: "quantidade_de_implementos", titulo: "Implementos", formato: "numero" },
      { id: "com_dolly", titulo: "Com dolly", formato: "sim_nao" },
      { id: "eixos_por_implemento", titulo: "Eixos por implemento", formato: "numero" },
    ],
  },
  {
    id: "nomenclatura",
    nome: "Nomes de conjunto",
    descricao: "O nome do conjunto por carroceria e configuração.",
    esquema: "config",
    tabela: "nomenclatura_de_conjunto",
    selecao: "carroceria_id, configuracao, nome",
    chave: ["carroceria_id", "configuracao"],
    busca: "nome",
    ordem: "nome",
    comArquivo: false,
    editavel: null,
    somenteLeituraPorque: "O nome é calculado pela tabela; a mudança passa pela equipe.",
    colunas: [
      { id: "nome", titulo: "Nome do conjunto" },
      {
        id: "carroceria",
        titulo: "Carroceria",
        campo: "carroceria_id",
        formato: "referencia",
        de: { esquema: "config", tabela: "carroceria" },
      },
      { id: "configuracao", titulo: "Configuração" },
    ],
  },
];

export function catalogoPorId(id: string | null | undefined): DefinicaoDoCatalogo {
  return CATALOGOS.find((c) => c.id === id) ?? CATALOGOS[0]!;
}

export interface LinhaDoCatalogo {
  chave: string;
  /** Só nos catálogos que se editam. */
  id: string;
  versao: number;
  arquivado: boolean;
  motivo: string | null;
  celulas: Record<string, string>;
}

export interface PaginaDoCatalogo {
  linhas: LinhaDoCatalogo[];
  total: number;
  pagina: number;
  paginas: number;
}
