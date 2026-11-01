// Quem pode citar a variável que liga os dados de exemplo (lib/exemplo/). Ela só pode existir onde
// foi liberada (desenvolvimento, testes e documentação) e nunca na Vercel, em produção ou em arquivo
// com segredo. A regra vive aqui, sem olhar o repositório, para o teste poder provar cada caso.

/** A lista fixa: vale para o resto do repositório, arquivo por arquivo. */
const LISTA_FIXA: readonly string[] = [
  ".env.development",
  ".env.example",
  "playwright.config.ts",
  "docs/decisoes.md",
];

/** Todo plano é documentação de trabalho e cita a variável à vontade: liberado por padrão. */
const PASTA_DOS_PLANOS = "docs/superpowers/plans/";

export function liberadoParaEixoDados(caminho: string): boolean {
  const c = caminho.replaceAll("\\", "/");
  // Um caminho que sobe de pasta não herda a liberação da pasta de onde "saiu".
  if (c.split("/").includes("..")) return false;
  if (c.startsWith(PASTA_DOS_PLANOS)) return true;
  if (LISTA_FIXA.includes(c)) return true;
  if (/^lib\/dados\/(fonte-de-exemplo|fonte)(\.test)?\.tsx?$/.test(c)) return true;
  if (/\.test\.tsx?$/.test(c)) return true;
  return c.startsWith(".github/workflows/pull-request.yml");
}
