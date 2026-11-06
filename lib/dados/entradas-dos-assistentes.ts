// A tradução do que a tela digita para o que o esquema Zod espera: campo de seleção vazio vira nulo,
// número que não é número some (o esquema pede o campo). Usada pelo resolvedor do formulário e no
// envio, para a tela e o servidor validarem exatamente a mesma entrada.

type Valores = Record<string, unknown>;

const vazioParaNulo = (valor: unknown) => (valor === "" || valor === undefined ? null : valor);
const numeroOuNada = (valor: unknown) => {
  const n = typeof valor === "string" && valor.trim() !== "" ? Number(valor) : valor;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};

/**
 * A entrada do cadastro de placa, no formato que `esquemaCadastrarPlaca` espera. Função, carroceria
 * e eixos só vão para o implemento (nos outros tipos o esquema os ignora).
 */
export function paraEntradaDoCadastro(valores: Valores): Valores {
  return {
    ...valores,
    tipo: valores.tipo === "" ? undefined : valores.tipo,
    ano: numeroOuNada(valores.ano),
    funcao: valores.funcao === "" ? undefined : valores.funcao,
    carroceriaId: vazioParaNulo(valores.carroceriaId),
    eixos: numeroOuNada(valores.eixos) ?? null,
  };
}
