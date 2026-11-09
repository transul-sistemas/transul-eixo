import type { FieldValues, Resolver } from "react-hook-form";
import { errosDoResolvedor } from "./erros-do-resolvedor";

/** O pedaço de um esquema Zod que o resolvedor usa (o MESMO esquema que o servidor roda). */
interface Esquema {
  safeParse: (entrada: unknown) =>
    | { success: true }
    | {
        success: false;
        error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] };
      };
}

/**
 * O resolvedor do formulário a partir do esquema compartilhado: monta a entrada que o servidor
 * recebe (`entrada`), valida, e devolve os erros no formato do React Hook Form. `paraCampo` leva o
 * erro de um campo do esquema ao campo da tela (quando os nomes diferem).
 */
export function resolvedorDoEsquema<V extends FieldValues>(
  esquema: Esquema,
  entrada: (valores: V) => unknown,
  paraCampo: (path: readonly PropertyKey[]) => readonly PropertyKey[] = (path) => path,
): Resolver<V> {
  return async (valores) => {
    const r = esquema.safeParse(entrada(valores));
    if (r.success) return { values: valores, errors: {} };
    return {
      values: {},
      errors: errosDoResolvedor<V>(
        r.error.issues.map((i) => ({ path: paraCampo(i.path), message: i.message })),
      ),
    };
  };
}
