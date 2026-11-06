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

  it("o nome do arquivo diz a origem e a hora, sem endereço", () => {
    const nome = nomeDoArquivo("nuvem", new Date("2026-11-06T15:30:00Z"));
    expect(nome).toBe("eixo-nuvem-2026-11-06T15-30-00.dump.enc");
  });
});
