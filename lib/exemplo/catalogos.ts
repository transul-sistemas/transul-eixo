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

export interface MarcaDeExemplo {
  id: string;
  nome: string;
}
export interface ModeloDeExemplo {
  id: string;
  nome: string;
  marcaId: string;
}
export interface GaragemDeExemplo {
  id: string;
  nome: string;
  filialId: string;
}
export interface MotoristaDeExemplo {
  id: string;
  nome: string;
}

export const MARCAS: readonly MarcaDeExemplo[] = [
  { id: "marca-volvo", nome: "Volvo" },
  { id: "marca-scania", nome: "Scania" },
  { id: "marca-mercedes", nome: "Mercedes-Benz" },
  { id: "marca-randon", nome: "Randon" },
  { id: "marca-librelato", nome: "Librelato" },
  { id: "marca-toyota", nome: "Toyota" },
];

export const MODELOS: readonly ModeloDeExemplo[] = [
  { id: "modelo-fh-540", nome: "FH 540", marcaId: "marca-volvo" },
  { id: "modelo-r-450", nome: "R 450", marcaId: "marca-scania" },
  { id: "modelo-actros-2651", nome: "Actros 2651", marcaId: "marca-mercedes" },
  { id: "modelo-atego-2426", nome: "Atego 2426", marcaId: "marca-mercedes" },
  { id: "modelo-sider", nome: "Sider 3 eixos", marcaId: "marca-randon" },
  { id: "modelo-graneleiro", nome: "Graneleiro 3 eixos", marcaId: "marca-librelato" },
  { id: "modelo-hilux", nome: "Hilux", marcaId: "marca-toyota" },
];

export const GARAGENS: readonly GaragemDeExemplo[] = [
  { id: "garagem-a1", nome: "Garagem A1", filialId: "filial-a" },
  { id: "garagem-a2", nome: "Garagem A2", filialId: "filial-a" },
  { id: "garagem-b1", nome: "Garagem B1", filialId: "filial-b" },
  { id: "garagem-c1", nome: "Garagem C1", filialId: "filial-c" },
  { id: "garagem-d1", nome: "Garagem D1", filialId: "filial-d" },
];

export const MOTORISTAS: readonly MotoristaDeExemplo[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  id: `motorista-${n}`,
  nome: `Motorista Exemplo ${String(n).padStart(3, "0")}`,
}));
