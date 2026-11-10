// `pnpm backup:banco [--nuvem] [--pasta <pasta>]` e `pnpm backup:restaurar <arquivo>` (Parte 4, 06/11/2026).
//  * pg_dump (formato custom) das áreas do Eixo e do histórico das migrations, criptografado com
//    AES-256-GCM; a chave sai da senha EIXO_BACKUP_SENHA (no .env.local, fora do Git) por scrypt.
//  * O backup é do banco local por padrão; da nuvem só com --nuvem (quando Alexandre pedir), pelo pooler,
//    com a senha do banco passada por variável de ambiente ao contêiner (nunca na linha de comando).
//  * Restaurar é só no banco local (substitui as áreas do Eixo de lá) e só depois de conferir o arquivo
//    inteiro (senha e integridade) antes de mandar o primeiro byte ao pg_restore.
//  * O staging (cópia provisória da v1 e lançamentos manuais) entra: volta junto na restauração.
//  * Os logins (auth.users) não entram: são do Supabase Auth (o Pro tem o backup do projeto inteiro).
//  * Nada de senha, chave ou endereço na tela: só o caminho e o tamanho do arquivo.
import { spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readSync, statSync } from "node:fs";
import { createReadStream, createWriteStream } from "node:fs";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { ErroDoEixo, textoDoErro } from "../lib/log/erro.ts";

export class ErroDoBackup extends ErroDoEixo {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDoBackup";
  }
}

export const ESQUEMAS_DO_BACKUP = [
  "nucleo",
  "operacional",
  "pessoas",
  "rh_clinico",
  "parceiros",
  "financeiro",
  "sync",
  "config",
  "auditoria",
  "staging",
  "supabase_migrations",
] as const;

const PASTA_PADRAO = "C:/Backups/eixo";
const CONTEINER_LOCAL = "supabase_db_TranSul_Eixo";
const CONTEINER_DA_API = "supabase_rest_TranSul_Eixo";
const NUVEM = {
  host: "aws-0-us-east-2.pooler.supabase.com",
  porta: "5432",
  usuario: "postgres.kbyhojdrpzdylexmlsip",
  banco: "postgres",
};

const MAGICA = Buffer.from("EIXOBK1\0", "latin1");
const TAM_SAL = 16;
const TAM_IV = 12;
const TAM_TAG = 16;
const CABECALHO = MAGICA.length + TAM_SAL + TAM_IV;

export function conferirSenha(senha: string | undefined): string {
  if (!senha) {
    throw new ErroDoBackup(
      "Falta a senha do backup: grave EIXO_BACKUP_SENHA no .env.local (fora do Git) e guarde-a fora desta máquina.",
    );
  }
  if (senha.length < 20)
    throw new ErroDoBackup("A senha do backup precisa ter pelo menos 20 caracteres.");
  return senha;
}

function chave(senha: string, sal: Buffer): Buffer {
  return scryptSync(senha, sal, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

export function argumentosDoBackup(argv: readonly string[]): { nuvem: boolean; pasta: string } {
  const resto = argv.filter((a) => a !== "--");
  let nuvem = false;
  let pasta = PASTA_PADRAO;
  for (let i = 0; i < resto.length; i++) {
    const a = resto[i];
    if (a === "--nuvem") nuvem = true;
    else if (a === "--pasta" && resto[i + 1]) pasta = resto[++i] as string;
    else throw new ErroDoBackup("Uso: pnpm backup:banco [--nuvem] [--pasta <pasta>]");
  }
  return { nuvem, pasta };
}

export function argumentosDaRestauracao(argv: readonly string[]): { arquivo: string } {
  const resto = argv.filter((a) => a !== "--");
  if (resto.includes("--nuvem")) {
    throw new ErroDoBackup(
      "Restaurar é só no banco local: a nuvem nunca recebe restauração por script.",
    );
  }
  if (resto.length !== 1 || resto[0]?.startsWith("--")) {
    throw new ErroDoBackup("Uso: pnpm backup:restaurar <arquivo .dump.enc>");
  }
  return { arquivo: resto[0] as string };
}

/** Recarrega o esquema da API (PostgREST) no banco local: o pg_restore recria as funções e, sem isso,
 * a API responde PGRST202 ("função não achada no cache") até reiniciar. Não altera dado. */
export function argumentosDoRecarregarApi(): string[] {
  return [
    "exec",
    CONTEINER_LOCAL,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "notify pgrst, 'reload schema'",
  ];
}

/** SIGUSR1 ao PostgREST local: recarrega o esquema sem desligar o contêiner. Reforço do notify, que
 * pode não chegar se a API perdeu a escuta do canal "pgrst" (visto em 10/11/2026). */
export function argumentosDoSinalDaApi(): string[] {
  return ["kill", "-s", "SIGUSR1", CONTEINER_DA_API];
}

export function nomeDoArquivo(origem: "local" | "nuvem", agora: Date): string {
  return `eixo-${origem}-${agora.toISOString().slice(0, 19).replace(/:/g, "-")}.dump.enc`;
}

/** Cifra o fluxo no arquivo: mágica, sal, IV, texto cifrado e a etiqueta de autenticação no fim. */
export async function criptografar(
  entrada: Readable,
  destino: string,
  senha: string,
): Promise<void> {
  const sal = randomBytes(TAM_SAL);
  const iv = randomBytes(TAM_IV);
  const cifra = createCipheriv("aes-256-gcm", chave(senha, sal), iv);
  const saida = createWriteStream(destino, { mode: 0o600 });
  saida.write(Buffer.concat([MAGICA, sal, iv]));
  await pipeline(entrada, cifra, saida, { end: false });
  await new Promise<void>((resolve, reject) => {
    saida.end(cifra.getAuthTag(), () => resolve());
    saida.on("error", reject);
  });
}

function cabecalhoDoArquivo(arquivo: string): {
  sal: Buffer;
  iv: Buffer;
  tag: Buffer;
  fim: number;
} {
  const tamanho = statSync(arquivo).size;
  const fd = openSync(arquivo, "r");
  try {
    const cab = Buffer.alloc(CABECALHO);
    if (tamanho < CABECALHO + TAM_TAG || readSync(fd, cab, 0, CABECALHO, 0) !== CABECALHO) {
      throw new ErroDoBackup("O arquivo não é um backup do Eixo.");
    }
    if (!cab.subarray(0, MAGICA.length).equals(MAGICA))
      throw new ErroDoBackup("O arquivo não é um backup do Eixo.");
    const tag = Buffer.alloc(TAM_TAG);
    readSync(fd, tag, 0, TAM_TAG, tamanho - TAM_TAG);
    return {
      sal: cab.subarray(MAGICA.length, MAGICA.length + TAM_SAL),
      iv: cab.subarray(MAGICA.length + TAM_SAL),
      tag,
      fim: tamanho - TAM_TAG - 1,
    };
  } finally {
    closeSync(fd);
  }
}

async function* passada(arquivo: string, senha: string, devolver: boolean) {
  const { sal, iv, tag, fim } = cabecalhoDoArquivo(arquivo);
  const decifra = createDecipheriv("aes-256-gcm", chave(senha, sal), iv);
  decifra.setAuthTag(tag);
  if (fim >= CABECALHO) {
    for await (const parte of createReadStream(arquivo, { start: CABECALHO, end: fim })) {
      const claro = decifra.update(parte as Buffer);
      if (devolver && claro.length > 0) yield claro;
    }
  }
  try {
    const resto = decifra.final();
    if (devolver && resto.length > 0) yield resto;
  } catch {
    throw new ErroDoBackup("Senha errada ou arquivo adulterado: o backup não confere.");
  }
}

/** Confere o arquivo inteiro (senha e integridade) e só então devolve o conteúdo. */
export async function* descriptografar(arquivo: string, senha: string): AsyncGenerator<Buffer> {
  for await (const _ of passada(arquivo, senha, false)) void _;
  yield* passada(arquivo, senha, true);
}

function rodar(comando: string, argumentos: string[], env?: NodeJS.ProcessEnv) {
  return spawn(comando, argumentos, { stdio: ["pipe", "pipe", "pipe"], env: env ?? process.env });
}

function esperar(processo: ReturnType<typeof spawn>, nome: string): Promise<void> {
  // A saída de erro do pg_dump e do pg_restore pode citar valor real ou o endereço: na tela, só o código
  // de saída (reforço de 06/11/2026).
  processo.stderr?.resume();
  return new Promise((resolve, reject) => {
    processo.on("close", (codigo) => {
      if (codigo === 0) resolve();
      else
        reject(new ErroDoBackup(`${nome} falhou (código de saída ${codigo ?? "desconhecido"}).`));
    });
  });
}

/** Lê uma linha do terminal sem eco (a senha nunca aparece nem vai para arquivo). */
function perguntarOculto(texto: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(texto);
    const entrada = process.stdin;
    let valor = "";
    if (entrada.isTTY) entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding("utf8");
    const ler = (parte: string) => {
      for (const c of parte) {
        if (c === "\r" || c === "\n") {
          entrada.off("data", ler);
          if (entrada.isTTY) entrada.setRawMode(false);
          entrada.pause();
          process.stdout.write("\n");
          resolve(valor);
          return;
        }
        if (c === "\u0003") process.exit(130);
        if (c === "\u007f" || c === "\b") valor = valor.slice(0, -1);
        else valor += c;
      }
    };
    entrada.on("data", ler);
  });
}

function carregarAmbiente() {
  for (const arquivo of [".env.local"]) if (existsSync(arquivo)) process.loadEnvFile(arquivo);
}

async function backup(argv: string[]) {
  carregarAmbiente();
  const { nuvem, pasta } = argumentosDoBackup(argv);
  const senha = conferirSenha(process.env.EIXO_BACKUP_SENHA);
  mkdirSync(pasta, { recursive: true });
  const destino = join(pasta, nomeDoArquivo(nuvem ? "nuvem" : "local", new Date()));
  const esquemas = ESQUEMAS_DO_BACKUP.flatMap((e) => ["-n", e]);

  let dump: ReturnType<typeof spawn>;
  if (nuvem) {
    // A senha do banco é digitada na hora, sem eco (roteiro de 06/11/2026); o ambiente só vale se existir.
    const senhaDoBanco =
      process.env.SUPABASE_DB_PASSWORD ||
      (await perguntarOculto("Senha do banco (não aparece ao digitar): "));
    if (!senhaDoBanco) throw new ErroDoBackup("Sem a senha do banco: nada foi feito.");
    dump = rodar(
      "docker",
      [
        "run",
        "--rm",
        "-e",
        "PGHOST",
        "-e",
        "PGPORT",
        "-e",
        "PGUSER",
        "-e",
        "PGPASSWORD",
        "-e",
        "PGDATABASE",
        "postgres:17",
        "pg_dump",
        "-Fc",
        "--no-owner",
        ...esquemas,
      ],
      {
        ...process.env,
        PGHOST: NUVEM.host,
        PGPORT: NUVEM.porta,
        PGUSER: NUVEM.usuario,
        PGPASSWORD: senhaDoBanco,
        PGDATABASE: NUVEM.banco,
      },
    );
  } else {
    dump = rodar("docker", [
      "exec",
      CONTEINER_LOCAL,
      "pg_dump",
      "-U",
      "postgres",
      "-Fc",
      "--no-owner",
      ...esquemas,
      "postgres",
    ]);
  }
  dump.stdin?.end();
  const fim = esperar(dump, "O pg_dump");
  await criptografar(dump.stdout as Readable, destino, senha);
  await fim;
  const kb = Math.ceil(statSync(destino).size / 1024);
  console.log(`Backup ${nuvem ? "da nuvem" : "local"} criptografado: ${destino} (${kb} KB).`);
  console.log("Guarde a senha do backup fora desta máquina: sem ela, o arquivo não abre.");
}

async function restaurar(argv: string[]) {
  carregarAmbiente();
  const { arquivo } = argumentosDaRestauracao(argv);
  const senha = conferirSenha(process.env.EIXO_BACKUP_SENHA);
  // Confere o arquivo inteiro antes de tocar no banco.
  for await (const _ of passada(arquivo, senha, false)) void _;
  const restore = rodar("docker", [
    "exec",
    "-i",
    CONTEINER_LOCAL,
    "pg_restore",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "--clean",
    "--if-exists",
    "--no-owner",
    "--single-transaction",
  ]);
  const fim = esperar(restore, "O pg_restore");
  await pipeline(passada(arquivo, senha, true), restore.stdin as NodeJS.WritableStream);
  await fim;
  await esperar(rodar("docker", argumentosDoRecarregarApi()), "O recarregamento do esquema da API");
  await esperar(rodar("docker", argumentosDoSinalDaApi()), "O sinal de recarga da API");
  console.log("Backup restaurado no banco local (áreas do Eixo e histórico das migrations).");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [acao, ...resto] = process.argv.slice(2);
  const tarefa = acao === "banco" ? backup(resto) : acao === "restaurar" ? restaurar(resto) : null;
  (
    tarefa ?? Promise.reject(new ErroDoBackup("Uso: node scripts/backup.ts banco|restaurar ..."))
  ).catch((erro: unknown) => {
    console.error(textoDoErro(erro));
    process.exit(1);
  });
}
