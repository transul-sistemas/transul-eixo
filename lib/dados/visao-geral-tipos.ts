// Os tipos de Resultados › Visão geral, sem nada de servidor. Dinheiro sempre em centavos inteiros
// (o componente de moeda recebe centavos); margem e participação em pontos percentuais com uma casa.

export interface ValoresDoResultado {
  receita: number;
  custo: number;
  resultado: number;
  /** `null` sem receita. */
  margem: number | null;
}

export interface MesDoResultado extends ValoresDoResultado {
  /** `aaaa-mm`. */
  mes: string;
}

export interface GrupoDoResultado extends ValoresDoResultado {
  chave: string | null;
  rotulo: string;
}

export interface NaturezaDoCusto {
  codnat: string | null;
  descricao: string;
  valor: number;
  participacao: number | null;
}

export interface AvisoDoResultado {
  lancamentos: number;
  valor: number;
}

export interface VisaoGeralDosResultados {
  /** `aaaa-mm`. */
  mes: string;
  diaDoCorte: number;
  /** Os meses com lançamento (`aaaa-mm`), do mais novo ao mais antigo. */
  meses: string[];
  kpis: ValoresDoResultado & {
    mudaramDeMes: AvisoDoResultado;
    semDtentsai: AvisoDoResultado;
    semCr: AvisoDoResultado;
  };
  serie: MesDoResultado[];
  grupos: GrupoDoResultado[];
  total: ValoresDoResultado;
  naturezas: NaturezaDoCusto[];
  outras: { naturezas: number; valor: number; participacao: number | null };
  opcoes: {
    filiais: { id: string; nome: string }[];
    operacoes: { id: string; nome: string }[];
  };
}
