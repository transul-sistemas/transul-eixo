import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  ErroDoBackup,
  ESQUEMAS_DO_BACKUP,
  argumentosDoBackup,
  argumentosDaRestauracao,
  argumentosDoRecarregarApi,
  argumentosDoSinalDaApi,
  conteinerDaApi,
  conteinerDoBanco,
  conferirSenha,
  criptografar,
  descriptografar,
  nomeDoArquivo,
} from "./backup";

// Parte 4 (06/11/2026): `pnpm backup:banco` e `pnpm backup:restaurar`, pg_dump criptografado
// (AES-256-GCM, chave derivada por scrypt da senha em EIXO_BACKUP_SENHA). Nada é impresso além de
// caminhos e tamanhos; a nuvem só com --nuvem; restaurar só no banco local.

async function cifrar(dados: Buffer, senha: string, destino: string) {
  await criptografar(Readable.from([dados]), destino, senha);
}

describe("criptografia do arquivo", () => {
  const pasta = mkdtempSync(join(tmpdir(), "eixo-backup-"));
  const senha = "uma senha de teste bem comprida";
  const dados = Buffer.from("PGDMP conteúdo fictício ".repeat(5000));

  it("ida e volta devolve os mesmos bytes", async () => {
    const arquivo = join(pasta, "ida-e-volta.dump.enc");
    await cifrar(dados, senha, arquivo);
    const partes: Buffer[] = [];
    for await (const p of descriptografar(arquivo, senha)) partes.push(p as Buffer);
    expect(Buffer.concat(partes).equals(dados)).toBe(true);
  });

  it("o arquivo não contém o texto original", async () => {
    const arquivo = join(pasta, "sem-texto.dump.enc");
    await cifrar(dados, senha, arquivo);
    expect(readFileSync(arquivo).includes(Buffer.from("PGDMP"))).toBe(false);
  });

  it("senha errada falha sem devolver nada", async () => {
    const arquivo = join(pasta, "senha-errada.dump.enc");
    await cifrar(dados, senha, arquivo);
    await expect(async () => {
      for await (const _ of descriptografar(arquivo, "outra senha bem comprida aqui")) void _;
    }).rejects.toThrow(ErroDoBackup);
  });

  it("arquivo adulterado falha", async () => {
    const arquivo = join(pasta, "adulterado.dump.enc");
    await cifrar(dados, senha, arquivo);
    const bytes = readFileSync(arquivo);
    bytes[bytes.length - 40] = (bytes[bytes.length - 40] ?? 0) ^ 0xff;
    writeFileSync(arquivo, bytes);
    await expect(async () => {
      for await (const _ of descriptografar(arquivo, senha)) void _;
    }).rejects.toThrow(ErroDoBackup);
  });

  it("arquivo que não é backup do Eixo é recusado", async () => {
    const arquivo = join(pasta, "outro.dump.enc");
    writeFileSync(arquivo, Buffer.from("isto não é um backup"));
    await expect(async () => {
      for await (const _ of descriptografar(arquivo, senha)) void _;
    }).rejects.toThrow(/não é um backup do Eixo/);
  });
});

describe("conferirSenha", () => {
  it("exige a senha e pelo menos 20 caracteres", () => {
    expect(() => conferirSenha(undefined)).toThrow(/EIXO_BACKUP_SENHA/);
    expect(() => conferirSenha("curta")).toThrow(/20 caracteres/);
    expect(conferirSenha("x".repeat(20))).toBe("x".repeat(20));
  });
});

describe("argumentos", () => {
  it("backup: local por padrão, nuvem só com --nuvem, pasta opcional", () => {
    expect(argumentosDoBackup([])).toEqual({ nuvem: false, pasta: "C:/Backups/eixo" });
    expect(argumentosDoBackup(["--nuvem"])).toEqual({ nuvem: true, pasta: "C:/Backups/eixo" });
    expect(argumentosDoBackup(["--pasta", "D:/b"])).toEqual({ nuvem: false, pasta: "D:/b" });
    expect(() => argumentosDoBackup(["--outro"])).toThrow(ErroDoBackup);
  });

  it("restaurar: exige o arquivo; nunca na nuvem", () => {
    expect(argumentosDaRestauracao(["a.dump.enc"])).toEqual({ arquivo: "a.dump.enc" });
    expect(() => argumentosDaRestauracao([])).toThrow(ErroDoBackup);
    expect(() => argumentosDaRestauracao(["a.dump.enc", "--nuvem"])).toThrow(/só no banco local/);
  });
});

describe("o que entra no backup", () => {
  it("as áreas do Eixo, o histórico das migrations e os logins", () => {
    for (const e of ["nucleo", "config", "auditoria", "supabase_migrations"]) {
      expect(ESQUEMAS_DO_BACKUP).toContain(e);
    }
  });

  it("o staging (cópia da v1 e lançamentos manuais) entra no backup e, por isso, volta na restauração", () => {
    expect(ESQUEMAS_DO_BACKUP).toContain("staging");
  });

  it("o nome do arquivo diz a origem e a hora, sem endereço", () => {
    const nome = nomeDoArquivo("nuvem", new Date("2026-11-06T15:30:00Z"));
    expect(nome).toBe("eixo-nuvem-2026-11-06T15-30-00.dump.enc");
  });
});

describe("depois da restauração", () => {
  // 10/11/2026: o pg_restore recria as funções e a API (PostgREST) fica com o cache velho: as telas
  // davam "O banco não respondeu" (PGRST202) até recarregar o esquema. A restauração recarrega sozinha.
  it("recarrega o esquema da API no banco local, sem alterar dado", () => {
    expect(argumentosDoRecarregarApi()).toEqual([
      "exec",
      "supabase_db_TranSul_Eixo",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "notify pgrst, 'reload schema'",
    ]);
  });

  it("também manda o sinal de recarga direto ao processo da API (o aviso pelo banco pode não chegar)", () => {
    // 10/11/2026: depois de várias restaurações seguidas, a API parou de ouvir o canal "pgrst" e o
    // notify não chegou; o SIGUSR1 recarrega o esquema sem desligar o contêiner.
    expect(argumentosDoSinalDaApi()).toEqual([
      "kill",
      "-s",
      "SIGUSR1",
      "supabase_rest_TranSul_Eixo",
    ]);
  });

  it("a restauração chama o recarregamento depois do pg_restore", () => {
    const codigo = readFileSync(new URL("./backup.ts", import.meta.url), "utf8");
    const corpo = codigo.slice(codigo.indexOf("async function restaurar("));
    const fimDoRestore = corpo.indexOf("await fim;");
    const recarga = corpo.indexOf("argumentosDoRecarregarApi()");
    expect(fimDoRestore).toBeGreaterThan(-1);
    expect(recarga).toBeGreaterThan(fimDoRestore);
    expect(corpo.indexOf("argumentosDoSinalDaApi()")).toBeGreaterThan(fimDoRestore);
  });
});

describe("o contêiner do banco: o do Eixo, ou um descartável de teste", () => {
  it("sem variável, é sempre o banco local do Eixo", () => {
    expect(conteinerDoBanco({})).toBe("supabase_db_TranSul_Eixo");
    expect(conteinerDaApi({})).toBe("supabase_rest_TranSul_Eixo");
  });
  it("aceita só contêiner de banco descartável (project_id eixo_descartavel)", () => {
    expect(conteinerDoBanco({ EIXO_CONTEINER_DO_BANCO: "supabase_db_eixo_descartavel" })).toBe(
      "supabase_db_eixo_descartavel",
    );
    expect(conteinerDaApi({ EIXO_CONTEINER_DA_API: "supabase_rest_eixo_descartavel" })).toBe(
      "supabase_rest_eixo_descartavel",
    );
  });
  it.each(["supabase_db_outro_projeto", "supabase_db_eixo_descartavel; rm", "postgres", "x"])(
    "recusa %j",
    (nome) => {
      expect(() => conteinerDoBanco({ EIXO_CONTEINER_DO_BANCO: nome })).toThrow(/descartável/);
      expect(() => conteinerDaApi({ EIXO_CONTEINER_DA_API: nome })).toThrow(/descartável/);
    },
  );
  it("os recarregamentos da API seguem o contêiner escolhido", () => {
    expect(argumentosDoRecarregarApi("supabase_db_eixo_descartavel")[1]).toBe(
      "supabase_db_eixo_descartavel",
    );
    expect(argumentosDoSinalDaApi("supabase_rest_eixo_descartavel")[3]).toBe(
      "supabase_rest_eixo_descartavel",
    );
  });
});
