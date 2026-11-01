import {
  ehBaixada,
  grupoDaSigla,
  NOMES_DAS_SIGLAS,
  REGRAS_DAS_SIGLAS,
  SIGLAS,
  type Sigla,
} from "@/lib/dominio/status";

// Compara a régua do banco (supabase/seed.sql) com o espelho em TypeScript (lib/dominio/status.ts).
// Funções puras sobre o texto do seed, para valer igual no teste e no repositório.

export interface LinhaDoCatalogo {
  sigla: string;
  nome: string;
  chip: string;
  camada: string;
  baixada: boolean;
  aplicaA: string;
  tipos: string[];
  ordem: number;
}

/** O trecho de um `insert into <tabela>` até o `;`. */
export function blocoDoSeed(seed: string, tabela: string): string {
  const achado = new RegExp(`insert\\s+into\\s+${tabela.replace(".", "\\.")}[\\s\\S]*?;`, "i").exec(
    seed,
  );
  return achado?.[0] ?? "";
}

export function lerSiglasDoSeed(seed: string): LinhaDoCatalogo[] {
  const linhas = [
    ...blocoDoSeed(seed, "config.status").matchAll(
      /\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(true|false),\s*'([^']+)',\s*array\[([^\]]*)\]::nucleo\.tipo_de_ativo\[\],\s*(\d+)\)/g,
    ),
  ];
  return linhas.map((m) => ({
    sigla: m[1] as string,
    nome: m[2] as string,
    chip: m[3] as string,
    camada: m[4] as string,
    baixada: m[5] === "true",
    aplicaA: m[6] as string,
    tipos: [...(m[7] as string).matchAll(/'([^']+)'/g)].map((t) => t[1] as string),
    ordem: Number(m[8]),
  }));
}

/** Cada diferença entre o seed e o espelho, em uma frase que começa pela sigla. Vazio = iguais. */
export function divergenciasDoCatalogo(linhas: readonly LinhaDoCatalogo[]): string[] {
  const achados: string[] = [];
  const doSeed = new Map(linhas.map((l) => [l.sigla, l]));
  const conhecidas = new Set<string>(SIGLAS);

  for (const linha of linhas) {
    if (!conhecidas.has(linha.sigla)) achados.push(`${linha.sigla}: está no seed e não no espelho`);
  }
  for (const [indice, sigla] of SIGLAS.entries()) {
    const linha = doSeed.get(sigla);
    if (!linha) {
      achados.push(`${sigla}: está no espelho e não no seed`);
      continue;
    }
    const regra = REGRAS_DAS_SIGLAS[sigla as Sigla];
    const confere = (campo: string, noSeed: unknown, noEspelho: unknown) => {
      if (JSON.stringify(noSeed) !== JSON.stringify(noEspelho)) {
        achados.push(
          `${sigla}: ${campo} é ${JSON.stringify(noSeed)} no seed e ${JSON.stringify(noEspelho)} no espelho`,
        );
      }
    };
    confere("nome", linha.nome, NOMES_DAS_SIGLAS[sigla]);
    confere("chip", linha.chip, grupoDaSigla(sigla));
    confere("camada", linha.camada, regra.camada);
    confere("aplica_a", linha.aplicaA, regra.aplicaA);
    confere("tipos válidos", [...linha.tipos].sort(), [...regra.tiposValidos].sort());
    confere("baixada", linha.baixada, ehBaixada(sigla));
    confere("ordem", linha.ordem, indice + 1);
  }
  return achados;
}
