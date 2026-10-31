// Catálogos de exemplo (gestores, operações, CRs e filiais) com ids estáveis. Os nomes são os mesmos
// que o gerador de placas usa (`Gestor Exemplo N`, `Operação Exemplo N`, `Filial Exemplo A`...), para
// uma placa gerada achar o seu gestor e a sua operação aqui. Nunca é importado fora de desenvolvimento
// e testes (ver lib/qualidade/barramento-do-exemplo.ts).

export interface GestorDeExemplo {
  id: string;
  nome: string;
}
export interface OperacaoDeExemplo {
  id: string;
  nome: string;
}
export interface CrDeExemplo {
  id: string;
  codigo: string;
  operacaoId: string;
}
export interface FilialDeExemplo {
  id: string;
  nome: string;
}

export const GESTORES: readonly GestorDeExemplo[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  id: `gestor-${n}`,
  nome: `Gestor Exemplo ${n}`,
}));

export const OPERACOES: readonly OperacaoDeExemplo[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `op-${n}`,
  nome: `Operação Exemplo ${n}`,
}));

/** Cada operação tem o seu CR vigente (`CR-1001` para a operação 1, e assim por diante). */
export const CRS: readonly CrDeExemplo[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `cr-${1000 + n}`,
  codigo: `CR-${1000 + n}`,
  operacaoId: `op-${n}`,
}));

export const FILIAIS: readonly FilialDeExemplo[] = ["A", "B", "C", "D"].map((letra) => ({
  id: `filial-${letra.toLowerCase()}`,
  nome: `Filial Exemplo ${letra}`,
}));
