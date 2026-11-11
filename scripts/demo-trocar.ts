// `pnpm demo:trocar -- real|demo [--sim] [--pasta <pasta>]`: volta o banco LOCAL ao backup do REAL ou ao da
// DEMONSTRAÇÃO (backups separados, nunca misturados). Veja docs/demonstracao.md.
//  * Os backups ficam em <pasta>/real e <pasta>/demo (padrão C:/Backups/eixo), feitos com
//    `pnpm backup:banco -- --pasta C:/Backups/eixo/real` (ou /demo). Este script usa o MAIS RECENTE de cada.
//  * Sem --sim, só diz o que faria (arquivo, tamanho). Com --sim, restaura pelo `backup:restaurar`, que
//    confere o arquivo inteiro (senha e integridade) antes de tocar no banco.
//  * Só o banco local; nunca apaga nem move backup; nunca chama a nuvem.
//  * O staging (abastecimento) agora faz parte do backup: volta junto, sem retoque à mão.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { enderecoDoBancoLocal } from "./banco-local.ts";
import { exigirBancoLocalParaDemo } from "./demo-dados.ts";
import { ErroDoEixo, textoDoErro } from "../lib/log/erro.ts";

export type Alvo = "real" | "demo";
const PASTA_PADRAO = "C:/Backups/eixo";

export function argumentosDoTrocar(argv: readonly string[]): {
  alvo: Alvo;
  confirmado: boolean;
  pasta: string;
} {
  const resto = argv.filter((a) => a !== "--");
  let alvo: Alvo | null = null;
  let confirmado = false;
  let pasta = PASTA_PADRAO;
  for (let i = 0; i < resto.length; i++) {
    const a = resto[i];
    if (a === "real" || a === "demo") alvo = a;
    else if (a === "--sim") confirmado = true;
    else if (a === "--pasta" && resto[i + 1]) pasta = resto[++i] as string;
    else throw new ErroDoEixo("Uso: pnpm demo:trocar -- real|demo [--sim] [--pasta <pasta>]");
  }
  if (!alvo) throw new ErroDoEixo("Diga para onde voltar: real ou demo.");
  return { alvo, confirmado, pasta };
}

/** O backup local mais recente da pasta (o nome leva a data, então a ordem do nome é a do tempo). */
export function backupMaisRecente(pasta: string): string | null {
  if (!existsSync(pasta)) return null;
  const nomes = readdirSync(pasta)
    .filter((n) => /^eixo-local-.*\.dump\.enc$/.test(n))
    .sort();
  const ultimo = nomes.at(-1);
  return ultimo ? join(pasta, ultimo) : null;
}

async function principal() {
  const { alvo, confirmado, pasta } = argumentosDoTrocar(process.argv.slice(2));
  const endereco = enderecoDoBancoLocal();
  exigirBancoLocalParaDemo(endereco);
  const arquivo = backupMaisRecente(join(pasta, alvo));
  if (!arquivo || statSync(arquivo).size < 1024) {
    throw new ErroDoEixo(
      `Não há backup do ${alvo} em ${join(pasta, alvo)}. Faça antes: pnpm backup:banco -- --pasta ${join(pasta, alvo)}`,
    );
  }
  console.log(`Backup do ${alvo}: ${arquivo} (${Math.ceil(statSync(arquivo).size / 1024)} KB).`);
  if (!confirmado) {
    console.log("Simulação: nada foi feito. Para restaurar de verdade, rode de novo com --sim.");
    return;
  }
  const r = spawnSync(process.execPath, ["scripts/backup.ts", "restaurar", arquivo], {
    stdio: "inherit",
  });
  if (r.status !== 0) throw new ErroDoEixo("A restauração falhou: o banco ficou como estava.");
  console.log(
    "Lembre: o backup não leva os logins. Se o login local sumiu, recrie com `pnpm dev:usuario`.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((erro: unknown) => {
    console.error(textoDoErro(erro));
    process.exit(1);
  });
}
