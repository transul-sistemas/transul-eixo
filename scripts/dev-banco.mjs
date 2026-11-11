// Sobe o servidor de telas só em modo banco, na porta 3000. A variável vai no ambiente do processo, que
// o Next respeita acima de .env.development e .env.local; assim um EIXO_DADOS do terminal não vale.
// Memória limitada a 1536 MB para o Node (máquina com pouca memória livre).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const next = require.resolve("next/dist/bin/next");

const filho = spawn(process.execPath, [next, "dev", "-p", "3000"], {
  stdio: "inherit",
  env: { ...process.env, EIXO_DADOS: "banco", NODE_OPTIONS: "--max-old-space-size=1536" },
});
filho.on("exit", (codigo) => process.exit(codigo ?? 0));
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => filho.kill(sinal));
