// `pnpm start:local`: prévia de PRODUÇÃO na porta 3000, ligada ao Supabase LOCAL.
// 1. Copia o código commitado de um ref (padrão origin/integracao) para .claude/worktrees/start-local,
//    por `git archive`: sem .env.local, sem importacao/ e sem nada fora do Git.
// 2. Liga o node_modules do projeto por junção e aponta o turbopack.root para a pasta do projeto.
// 3. Faz o build com o endereço e a chave publicável do Supabase local só no ambiente do processo
//    (lidos do `supabase status`, nunca impressos nem gravados), com memória limitada.
// 4. Prova que o build não contém endereço nem chave da nuvem (só contagens) e sobe `next start`.
// Uso: pnpm start:local [-- --ref <ref>] [-- --sem-build]
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Marcas da nuvem que nunca podem aparecer no build local. */
export const MARCAS_DA_NUVEM: readonly RegExp[] = [
  /[a-z0-9]{20}\.supabase\.co/g,
  /kbyhojdrpzdylexmlsip/g,
  /oubrtcgtugeijbrxvblc/g,
  /sb_secret_[A-Za-z0-9_-]+/g,
  /service_role/g,
];

/** Conta as marcas da nuvem num texto; devolve só os nomes e as contagens, nunca o trecho. */
export function contarMarcasDaNuvem(texto: string): Record<string, number> {
  const achados: Record<string, number> = {};
  for (const marca of MARCAS_DA_NUVEM) {
    const n = texto.match(marca)?.length ?? 0;
    if (n > 0) achados[marca.source] = n;
  }
  return achados;
}

/** Insere `root` no bloco `turbopack` do next.config.ts (a junção do node_modules aponta para fora da cópia). */
export function comRaizDoTurbopack(config: string, raiz: string): string {
  if (config.includes("root:")) return config;
  const barra = raiz.replaceAll("\\", "/");
  const novo = config.replace(
    /turbopack:\s*\{/,
    (m) => `${m}\n    root: ${JSON.stringify(barra)},`,
  );
  if (novo === config)
    throw new Error("next.config.ts sem bloco turbopack: não sei onde pôr a raiz.");
  return novo;
}

/** Lê do texto de `supabase status -o env` só o endereço e a chave publicável. */
export function lerSupabaseLocal(status: string): { url: string; chave: string } {
  const valores = Object.fromEntries(
    status
      .split(/\r?\n/)
      .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  const url = valores.API_URL ?? "";
  const chave = valores.PUBLISHABLE_KEY ?? "";
  if (!url || !chave)
    throw new Error(
      "O supabase status não trouxe API_URL e PUBLISHABLE_KEY. O Supabase local está ligado?",
    );
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+/.test(url)) {
    throw new Error("O endereço do Supabase não é local; recusado.");
  }
  return { url, chave };
}

function arquivosDe(pasta: string): string[] {
  const saida: string[] = [];
  for (const item of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, item.name);
    if (item.isSymbolicLink()) continue;
    if (item.isDirectory()) {
      if (item.name === "cache") continue;
      saida.push(...arquivosDe(caminho));
    } else if (/\.(js|mjs|cjs|json|html|rsc|body|meta|txt)$/.test(item.name)) {
      saida.push(caminho);
    }
  }
  return saida;
}

function removerCopia(destino: string): void {
  if (!existsSync(destino)) return;
  const nm = join(destino, "node_modules");
  // A junção sai primeiro, sem recursão: nunca apaga o node_modules do projeto.
  if (existsSync(nm) && lstatSync(nm).isSymbolicLink()) rmdirSync(nm);
  rmSync(destino, { recursive: true, force: true });
}

function rodar(cmd: string, args: string[], opcoes: Parameters<typeof spawnSync>[2] = {}): void {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opcoes });
  if (r.status !== 0) throw new Error(`${cmd} ${args[0] ?? ""} terminou com código ${r.status}.`);
}

function principal(): void {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const iRef = args.indexOf("--ref");
  const ref = iRef >= 0 ? (args[iRef + 1] ?? "") : "origin/integracao";
  const semBuild = args.includes("--sem-build");
  const projeto = resolve(".");
  const destino = join(projeto, ".claude", "worktrees", "start-local");
  const next = join(projeto, "node_modules", "next", "dist", "bin", "next");

  const status = spawnSync("pnpm", ["exec", "supabase", "status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    shell: true,
  });
  const { url, chave } = lerSupabaseLocal(String(status.stdout ?? ""));

  // Ambiente do processo: só o Supabase local; nada de chave secreta herdada do terminal.
  const ambiente: NodeJS.ProcessEnv = { ...process.env };
  for (const nome of Object.keys(ambiente)) {
    if (/SUPABASE|SERVICE_ROLE|SANKHYA/i.test(nome)) delete ambiente[nome];
  }
  Object.assign(ambiente, {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: chave,
    EIXO_DADOS: "banco",
    NEXT_TELEMETRY_DISABLED: "1",
  });

  if (!semBuild) {
    rodar("git", ["fetch", "-q", "origin"]);
    removerCopia(destino);
    mkdirSync(destino, { recursive: true });
    const tar = join(projeto, ".claude", "worktrees", "start-local.tar");
    rodar("git", ["archive", "--format=tar", "-o", tar, ref]);
    // No Windows, o tar do Git Bash lê "C:" como máquina remota; usa o tar do sistema.
    const tarDoSistema =
      process.platform === "win32"
        ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe")
        : "tar";
    rodar(tarDoSistema, ["-xf", tar, "-C", destino]);
    rmSync(tar, { force: true });
    for (const proibido of [".env.local", "importacao"]) {
      rmSync(join(destino, proibido), { recursive: true, force: true });
    }
    symlinkSync(join(projeto, "node_modules"), join(destino, "node_modules"), "junction");
    const cfg = join(destino, "next.config.ts");
    writeFileSync(cfg, comRaizDoTurbopack(readFileSync(cfg, "utf8"), projeto), "utf8");

    console.log(`[start:local] build de ${ref} (cópia sem .env.local e sem importacao/)`);
    rodar(process.execPath, [next, "build"], {
      cwd: destino,
      env: { ...ambiente, NODE_OPTIONS: "--max-old-space-size=3072" },
    });
  }

  const pastaDoBuild = join(destino, ".next");
  if (!existsSync(pastaDoBuild)) throw new Error("Não há build; rode sem --sem-build.");
  const arquivos = arquivosDe(pastaDoBuild);
  const total: Record<string, number> = {};
  let comLocal = 0;
  for (const arquivo of arquivos) {
    const texto = readFileSync(arquivo, "utf8");
    for (const [marca, n] of Object.entries(contarMarcasDaNuvem(texto)))
      total[marca] = (total[marca] ?? 0) + n;
    if (texto.includes(url)) comLocal += 1;
  }
  if (Object.keys(total).length > 0) {
    console.error(`[start:local] RECUSADO: o build tem marcas da nuvem: ${JSON.stringify(total)}`);
    process.exit(1);
  }
  console.log(
    `[start:local] prova: ${arquivos.length} arquivos do build lidos, 0 marcas da nuvem; endereço local em ${comLocal} arquivo(s).`,
  );

  const filho = spawn(process.execPath, [next, "start", "-p", "3000"], {
    cwd: destino,
    stdio: "inherit",
    env: { ...ambiente, NODE_OPTIONS: "--max-old-space-size=1024" },
  });
  filho.on("exit", (codigo) => process.exit(codigo ?? 0));
  for (const sinal of ["SIGINT", "SIGTERM"] as const) process.on(sinal, () => filho.kill(sinal));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    principal();
  } catch (e) {
    // log-seguro: os erros deste script são textos nossos (git, tar, next e as guardas acima)
    console.error(`[start:local] ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
