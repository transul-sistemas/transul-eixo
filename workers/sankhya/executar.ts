// O executor de `pnpm sankhya:consulta consultas/<arquivo>.sql [--linhas N]` (fatia S0).
//  * Só arquivos .sql de consultas/ (nunca SQL montado na hora), sempre pela guarda.
//  * Por padrão grava e mostra só o resumo; --linhas N grava até N linhas no arquivo de resultado, e só
//    para tabela sem dado pessoal. O resultado fica em importacao/resultados/ (fora do Git) e a tela
//    mostra só agregados.
//  * Credenciais só por variáveis de ambiente; nenhuma é impressa. No CI, nunca consulta o Sankhya real.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import type { ResultadoDaConsulta } from "./cliente.ts";
import { conferirConsulta, envolverComLimite } from "./guarda.ts";
import { resumir, textoDoResumo, type ResumoDaConsulta } from "./resumo.ts";

export const VARIAVEIS_DO_SANKHYA = [
  "SANKHYA_BASE_URL",
  "SANKHYA_CLIENT_ID",
  "SANKHYA_CLIENT_SECRET",
  "SANKHYA_X_TOKEN",
] as const;

export class ErroDaExecucao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDaExecucao";
  }
}

export interface ConsultaDoSankhya {
  consultar(sql: string): Promise<ResultadoDaConsulta>;
}

export interface CredenciaisDoSankhya {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  xToken: string;
}

export function lerArgumentos(argumentos: string[]): {
  arquivo: string;
  linhas: number | undefined;
} {
  const [arquivo, ...resto] = argumentos;
  if (!arquivo || arquivo.startsWith("--")) {
    throw new ErroDaExecucao("Uso: pnpm sankhya:consulta consultas/<arquivo>.sql [--linhas N]");
  }
  if (resto.length === 0) return { arquivo, linhas: undefined };
  if (resto[0] !== "--linhas" || resto.length !== 2 || !/^\d+$/.test(resto[1] ?? "")) {
    throw new ErroDaExecucao("Uso: pnpm sankhya:consulta consultas/<arquivo>.sql [--linhas N]");
  }
  return { arquivo, linhas: Number(resto[1]) };
}

export async function executarConsulta(opcoes: {
  arquivo: string;
  linhas: number | undefined;
  raiz: string;
  ambiente: Record<string, string | undefined>;
  criarCliente: (credenciais: CredenciaisDoSankhya) => ConsultaDoSankhya;
  agora?: () => Date;
}): Promise<{ texto: string; caminho: string; resumo: ResumoDaConsulta }> {
  const relativo = normalize(opcoes.arquivo).split(sep).join("/");
  if (!/^consultas\/[\w.-]+\.sql$/.test(relativo)) {
    throw new ErroDaExecucao(
      "Só arquivos .sql da pasta consultas/ (nunca SQL montado na hora nem fora da pasta).",
    );
  }

  const modo = opcoes.linhas === undefined ? "resumo" : "linhas";
  const sql = envolverComLimite(
    conferirConsulta(readFileSync(join(opcoes.raiz, relativo), "utf8"), { modo }),
    opcoes.linhas,
  );

  if (opcoes.ambiente.CI) {
    throw new ErroDaExecucao(
      "No CI a ponte não consulta o Sankhya real (só os testes com o servidor falso).",
    );
  }
  const faltam = VARIAVEIS_DO_SANKHYA.filter((v) => !opcoes.ambiente[v]);
  if (faltam.length > 0) {
    throw new ErroDaExecucao(
      `Faltam as variáveis ${faltam.join(", ")} (em .env.sankhya.local, fora do Git).`,
    );
  }

  const cliente = opcoes.criarCliente({
    baseUrl: opcoes.ambiente.SANKHYA_BASE_URL as string,
    clientId: opcoes.ambiente.SANKHYA_CLIENT_ID as string,
    clientSecret: opcoes.ambiente.SANKHYA_CLIENT_SECRET as string,
    xToken: opcoes.ambiente.SANKHYA_X_TOKEN as string,
  });
  const resultado = await cliente.consultar(sql);
  const resumo = resumir(resultado);

  const quando = (opcoes.agora ?? (() => new Date()))()
    .toISOString()
    .slice(0, 19)
    .replace(/:/g, "-");
  const nome = relativo.slice("consultas/".length, -".sql".length);
  const pasta = join(opcoes.raiz, "importacao", "resultados");
  mkdirSync(pasta, { recursive: true });
  const caminho = join(pasta, `${nome}-${quando}.json`);
  const conteudo = {
    arquivo: relativo,
    modo,
    executadoEm: quando,
    resumo,
    ...(modo === "linhas"
      ? { colunas: resultado.colunas, linhas: resultado.linhas.slice(0, opcoes.linhas) }
      : {}),
  };
  writeFileSync(caminho, JSON.stringify(conteudo, null, 2), "utf8");

  return { texto: textoDoResumo(relativo, resumo), caminho, resumo };
}
