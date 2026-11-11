// Sobe o servidor de telas só em modo banco, na porta 3000. A variável vai no ambiente do processo, que
// o Next respeita acima de .env.development e .env.local; assim um EIXO_DADOS do terminal não vale.
// Memória limitada a 1536 MB para o Node (máquina com pouca memória livre).
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const next = require.resolve("next/dist/bin/next");

// Antes do Next: confere se o banco local tem as funções que o app chama. Só avisa, nunca derruba o servidor.
const paridade = spawnSync(process.execPath, ["scripts/paridade-do-banco.ts"], {
  encoding: "utf8",
});
if (paridade.status !== 0) {
  console.warn(
    "\n[aviso] o banco local não bate com o código; telas podem mostrar erro de leitura.",
  );
  const texto = String(paridade.stderr || paridade.stdout || "");
  // Só as linhas da paridade (o Node avisa do módulo sem tipo em linhas que começam com "(node:" ou "Reparsing").
  console.warn(
    texto
      .split("\n")
      .filter((l) => !/^\(node:|^Reparsing|^To eliminate|^\(Use `node/.test(l))
      .join("\n")
      .trim(),
  );
  console.warn("");
}

const filho = spawn(process.execPath, [next, "dev", "-p", "3000"], {
  stdio: "inherit",
  env: { ...process.env, EIXO_DADOS: "banco", NODE_OPTIONS: "--max-old-space-size=1536" },
});
filho.on("exit", (codigo) => process.exit(codigo ?? 0));
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => filho.kill(sinal));
