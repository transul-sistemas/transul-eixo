// Os tipos da tela de usuários e perfis: sem acesso ao banco, então o navegador pode importar.

export interface ItemDeCatalogo {
  codigo: string;
  nome: string;
}

export interface UsuarioDaLista {
  pessoaId: string;
  nome: string;
  /** O código do perfil (o assistente grava este). */
  perfil: string;
  perfilNome: string;
  ativo: boolean;
  versao: number;
  /** Os escopos que o perfil dá (nomes: "Tudo", "Minha carteira"...). */
  escopos: string[];
  filiais: string[];
  operacoes: string[];
}

export interface DadosDaMatriz {
  perfis: ItemDeCatalogo[];
  modulos: ItemDeCatalogo[];
  acoes: ItemDeCatalogo[];
  escopos: ItemDeCatalogo[];
  permissoes: { perfil: string; modulo: string; acao: string; escopo: string }[];
}

export interface MatrizDoPerfil {
  perfil: ItemDeCatalogo;
  acoes: ItemDeCatalogo[];
  /** Uma linha por módulo; a célula é o nome do escopo, ou nulo se o perfil não pode. */
  linhas: { modulo: string; celulas: Record<string, string | null> }[];
}
