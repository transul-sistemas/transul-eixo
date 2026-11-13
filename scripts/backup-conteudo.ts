// `pnpm backup:conteudo -- <arquivo>`: diz SÓ contagens do que um backup guarda (placas reais, placas Demo,
// parâmetro banco_em_demonstracao, migrations), sem restaurar nada e sem tocar no banco. Confere a senha e a
// integridade do arquivo, converte o dump em texto num pg_restore descartável (sem banco de destino) e conta
// as linhas dos COPY que interessam. Nada de linha, nome, CPF ou placa é impresso.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import { ErroDoEixo, textoDoErro } from "../lib/log/erro.ts";
import { ErroDoBackup, conferirSenha, conteinerDoBanco, descriptografar } from "./backup.ts";

export type ConteudoDoBackup = {
  placasReais: number;
  placasDemo: number;
  bancoEmDemonstracao: boolean;
  migrations: number;
  ultimaMigration: string;
};

const PLACA_DEMO = "ZDM";
// No texto do pg_restore, o fim de um COPY é barra + ponto e o nulo é barra + N.
const BARRA = String.fromCharCode(92);
const FIM_DO_COPY = `${BARRA}.`;
const NULO = `${BARRA}N`;

/** Lê o texto do pg_restore linha a linha e conta; guarda só números. */
export class ContadorDoBackup {
  private tabela: string | null = null;
  private colunas: string[] = [];
  private r: ConteudoDoBackup = {
    placasReais: 0,
    placasDemo: 0,
    bancoEmDemonstracao: false,
    migrations: 0,
    ultimaMigration: "",
  };

  linha(l: string): void {
    const inicio = /^COPY ([\w."]+) \(([^)]*)\) FROM stdin;$/.exec(l);
    if (inicio) {
      this.tabela = inicio[1]!.replaceAll('"', "");
      this.colunas = inicio[2]!.split(",").map((c) => c.trim().replaceAll('"', ""));
      return;
    }
    if (l === FIM_DO_COPY) {
      this.tabela = null;
      return;
    }
    if (!this.tabela) return;
    const interessa =
      this.tabela === "nucleo.placa_do_ativo" ||
      this.tabela === "config.parametro" ||
      this.tabela === "supabase_migrations.schema_migrations";
    if (!interessa) return;
    const campos = l.split("\t");
    const valor = (nome: string) => campos[this.colunas.indexOf(nome)];
    if (this.tabela === "nucleo.placa_do_ativo") {
      if (valor("excluido_em") !== NULO) return;
      if ((valor("placa") ?? "").startsWith(PLACA_DEMO)) this.r.placasDemo++;
      else this.r.placasReais++;
    } else if (this.tabela === "config.parametro") {
      if (valor("chave") === "banco_em_demonstracao") this.r.bancoEmDemonstracao = true;
    } else {
      this.r.migrations++;
      const v = valor("version") ?? "";
      if (v > this.r.ultimaMigration) this.r.ultimaMigration = v;
    }
  }

  resultado(): ConteudoDoBackup {
    return { ...this.r };
  }
}

export function rotuloDoConteudo(c: ConteudoDoBackup): string {
  return c.placasDemo > 0 || c.bancoEmDemonstracao ? "real com demo" : "real sem demo";
}

async function conteudo(arquivo: string): Promise<void> {
  if (!arquivo || !existsSync(arquivo))
    throw new ErroDoBackup("Uso: pnpm backup:conteudo -- <arquivo do backup>.");
  process.loadEnvFile?.(".env.local");
  const senha = conferirSenha(process.env.EIXO_BACKUP_SENHA);
  const p = spawn("docker", ["exec", "-i", conteinerDoBanco(), "pg_restore", "-f", "-"], {
    stdio: ["pipe", "pipe", "ignore"],
  });
  const contador = new ContadorDoBackup();
  const lendo = (async () => {
    for await (const l of createInterface({ input: p.stdout! })) contador.linha(l);
  })();
  const saiu = new Promise<number | null>((ok) => p.on("close", ok));
  p.stdin.on("error", () => undefined);
  for await (const parte of descriptografar(arquivo, senha)) {
    if (!p.stdin.write(parte)) await new Promise((ok) => p.stdin.once("drain", ok));
  }
  p.stdin.end();
  await lendo;
  if ((await saiu) !== 0) throw new ErroDoBackup("A leitura do backup falhou.");
  const c = contador.resultado();
  console.log(`Backup lido sem restaurar nada: ${rotuloDoConteudo(c)}.`);
  console.log(`  placas reais: ${c.placasReais}`); // log-seguro: só a contagem
  console.log(`  placas Demo (ZDM): ${c.placasDemo}`); // log-seguro: só a contagem
  console.log(
    `  parâmetro banco_em_demonstracao: ${c.bancoEmDemonstracao ? "presente" : "ausente"}`,
  );
  console.log(`  migrations: ${c.migrations} (a última: ${c.ultimaMigration || "nenhuma"})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arquivo = process.argv.slice(2).filter((a) => a !== "--")[0] ?? "";
  conteudo(arquivo).catch((e: unknown) => {
    // log-seguro: ErroDoEixo traz texto nosso; o resto passa por textoDoErro
    console.error(e instanceof ErroDoEixo ? e.message : textoDoErro(e));
    process.exit(1);
  });
}
