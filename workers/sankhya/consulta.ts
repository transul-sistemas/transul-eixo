// Ponto de entrada de `pnpm sankhya:consulta consultas/<arquivo>.sql [--linhas N]` (fatia S0).
// As credenciais vêm de .env.sankhya.local ou, sem ele, de .env.local (os dois fora do Git), carregados
// pelo Node (process.loadEnvFile, o mesmo formato do dotenv); nada delas é impresso.

import { existsSync } from "node:fs";
import { criarClienteSankhya, ErroDoSankhya, mascarar } from "./cliente.ts";
import { ErroDaExecucao, executarConsulta, lerArgumentos } from "./executar.ts";
import { ErroDaGuarda } from "./guarda.ts";

const ARQUIVOS_DE_AMBIENTE = [".env.sankhya.local", ".env.local"];

async function principal() {
  for (const arquivo of ARQUIVOS_DE_AMBIENTE) if (existsSync(arquivo)) process.loadEnvFile(arquivo);
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
  // Só o texto das nossas classes (guarda, execução e cliente, com os segredos mascarados); de qualquer
  // outro erro, só o nome: a mensagem crua pode trazer dado.
  const nosso =
    erro instanceof ErroDaGuarda || erro instanceof ErroDaExecucao || erro instanceof ErroDoSankhya;
  // log-seguro: a mensagem é das classes da ponte (texto nosso), mascarada.
  console.error(
    nosso ? mascarar(erro.message, segredos) : erro instanceof Error ? erro.name : "erro",
  );
  process.exitCode = 1;
});
