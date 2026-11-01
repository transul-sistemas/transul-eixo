import type { FieldErrors, FieldValues } from "react-hook-form";

/**
 * Os problemas do Zod no formato de erros do React Hook Form: o caminho `conjunto.cavaloId` vira
 * `{ conjunto: { cavaloId: { type, message } } }`. Vale a primeira mensagem de cada campo.
 */
export function errosDoResolvedor<V extends FieldValues>(
  problemas: readonly { path: readonly PropertyKey[]; message: string }[],
): FieldErrors<V> {
  const raiz: Record<string, unknown> = {};
  for (const { path, message } of problemas) {
    let no = raiz;
    path.forEach((parte, i) => {
      const chave = String(parte);
      if (i === path.length - 1) {
        if (!(chave in no)) no[chave] = { type: "validate", message };
      } else {
        no = (no[chave] ??= {}) as Record<string, unknown>;
      }
    });
  }
  return raiz as FieldErrors<V>;
}
