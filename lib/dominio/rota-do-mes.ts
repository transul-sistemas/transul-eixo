// A4 · Rota na rodovia: a série de posições de uma placa no mês (um ponto por dia, nível de cidade), da
// Posição do dia (nucleo.serie_de_posicoes). Regra pura: agrupa os dias seguidos na mesma cidade em
// trechos ("Cidade Demo 1 · 01/11 a 04/11") e conta as mudanças de cidade. Nada é inventado: dia sem
// resposta não vira ponto, e "Sem sinal" é um trecho próprio.

export interface PontoDaRota {
  dia: string;
  cidade: string | null;
  uf: string | null;
  semSinal: boolean;
}

export interface TrechoDaRota {
  de: string;
  ate: string;
  dias: number;
  cidade: string | null;
  uf: string | null;
  semSinal: boolean;
}

const chave = (p: PontoDaRota) => (p.semSinal ? "sem-sinal" : `${p.cidade ?? ""}|${p.uf ?? ""}`);

/** O dia seguinte a `dia` (aaaa-mm-dd), contado em UTC para não depender do fuso nem do horário de verão. */
function diaSeguinte(dia: string): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/**
 * Os trechos, na ordem dos dias; dias SEGUIDOS no mesmo lugar formam um trecho. Um dia sem resposta no
 * meio quebra o trecho (nada é presumido sobre o dia que faltou).
 */
export function trechosDaRota(pontos: readonly PontoDaRota[]): TrechoDaRota[] {
  const ordenados = [...pontos].sort((a, b) => a.dia.localeCompare(b.dia));
  const trechos: TrechoDaRota[] = [];
  for (const p of ordenados) {
    const ultimo = trechos.at(-1);
    if (
      ultimo &&
      diaSeguinte(ultimo.ate) === p.dia &&
      chave({ ...ultimo, dia: ultimo.ate }) === chave(p)
    ) {
      ultimo.ate = p.dia;
      ultimo.dias += 1;
    } else {
      trechos.push({
        de: p.dia,
        ate: p.dia,
        dias: 1,
        cidade: p.cidade,
        uf: p.uf,
        semSinal: p.semSinal,
      });
    }
  }
  return trechos;
}

/** Quantas vezes a placa mudou de cidade no mês ("Sem sinal" não conta como mudança). */
export function mudancasDeCidade(pontos: readonly PontoDaRota[]): number {
  const comCidade = [...pontos]
    .filter((p) => !p.semSinal && p.cidade)
    .sort((a, b) => a.dia.localeCompare(b.dia));
  let mudancas = 0;
  for (let i = 1; i < comCidade.length; i++) {
    if (chave(comCidade[i]!) !== chave(comCidade[i - 1]!)) mudancas += 1;
  }
  return mudancas;
}
