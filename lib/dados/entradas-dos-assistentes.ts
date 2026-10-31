// A tradução do que a tela digita para o que o esquema Zod espera: campo de seleção vazio vira nulo,
// número que não é número some (o esquema pede o campo), meta zero vira vazia. Usada pelo resolvedor
// do formulário e no envio, para a tela e o servidor validarem exatamente a mesma entrada.

type Valores = Record<string, unknown>;

const vazioParaNulo = (valor: unknown) => (valor === "" || valor === undefined ? null : valor);
const numeroOuNada = (valor: unknown) =>
  typeof valor === "number" && Number.isFinite(valor) ? valor : undefined;

/** A entrada do cadastro de placa, no formato que `esquemaCadastrarPlaca` espera. */
export function paraEntradaDoCadastro(valores: Valores): Valores {
  return {
    ...valores,
    tipo: valores.tipo === "" ? undefined : valores.tipo,
    ano: numeroOuNada(valores.ano),
    operacaoId: vazioParaNulo(valores.operacaoId),
    crId: vazioParaNulo(valores.crId),
  };
}

/** A entrada do recebimento, no formato que `esquemaRecebimento(tipo)` espera. */
export function paraEntradaDoRecebimento(valores: Valores): Valores & {
  conjunto: { cavaloId: unknown; implementoIds: unknown };
} {
  const conjunto = (valores.conjunto ?? {}) as Valores;
  return {
    ...valores,
    operacaoId: vazioParaNulo(valores.operacaoId),
    crId: vazioParaNulo(valores.crId),
    motoristaId: vazioParaNulo(valores.motoristaId),
    metaDoConjuntoCentavos:
      typeof valores.metaDoConjuntoCentavos === "number" && valores.metaDoConjuntoCentavos > 0
        ? valores.metaDoConjuntoCentavos
        : null,
    conjunto: {
      cavaloId: vazioParaNulo(conjunto.cavaloId),
      implementoIds: conjunto.implementoIds ?? [],
    },
  };
}
