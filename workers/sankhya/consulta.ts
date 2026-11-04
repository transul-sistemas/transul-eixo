// Ponto de entrada de `pnpm sankhya:consulta consultas/<arquivo>.sql [--linhas N]` (fatia S0).
// As credenciais vêm de .env.sankhya.local (fora do Git), carregado pelo Node (process.loadEnvFile, o
// mesmo formato do dotenv); nada delas é impresso.

import { existsSync } from "node:fs";
import { criarClienteSankhya, mascarar } from "./cliente.ts";
import { executarConsulta, lerArgumentos } from "./executar.ts";

const ARQUIVO_DE_AMBIENTE = ".env.sankhya.local";

async function principal() {
  if (existsSync(ARQUIVO_DE_AMBIENTE)) process.loadEnvFile(ARQUIVO_DE_AMBIENTE);
  const { arquivo, linhas } = lerArgumentos(process.argv.slice(2));
  const saida = await executarConsulta({
    arquivo,
    linhas,
    raiz: process.cwd(),
    ambiente: process.env,
    criarCliente: (credenciais) => criarClienteSankhya(credenciais),
  });
  console.log(saida.texto);
  console.log(`Resultado gravado fora do Git: ${saida.caminho}`);
}

principal().catch((erro: unknown) => {
  const segredos = [
    process.env.SANKHYA_CLIENT_SECRET,
    process.env.SANKHYA_X_TOKEN,
    process.env.SANKHYA_CLIENT_ID,
  ].filter((s): s is string => Boolean(s));
  console.error(mascarar(erro instanceof Error ? erro.message : String(erro), segredos));
  process.exitCode = 1;
});
