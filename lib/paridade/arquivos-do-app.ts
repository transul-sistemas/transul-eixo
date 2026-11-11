import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Código do app que pode chamar o banco (sem testes): onde procurar as chamadas `.rpc`. */
export function arquivosDoApp(raiz: string): { caminho: string; texto: string }[] {
  const saida: { caminho: string; texto: string }[] = [];
  for (const pasta of ["lib", "app", "components"]) {
    const base = join(raiz, pasta);
    for (const rel of readdirSync(base, { recursive: true, encoding: "utf8" })) {
      const caminho = rel.replaceAll("\\", "/");
      if (!/\.tsx?$/.test(caminho) || /\.test\.tsx?$/.test(caminho)) continue;
      if (pasta === "lib" && caminho === "dados/tipos-do-banco.ts") continue;
      saida.push({ caminho: `${pasta}/${caminho}`, texto: readFileSync(join(base, rel), "utf8") });
    }
  }
  return saida;
}
